import datetime
from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal

from backend.database import models


@dataclass
class OpenLot:
    """A buy lot with quantity remaining to be matched against future sells"""

    buy: models.Trade
    quantity: Decimal


@dataclass
class LotSlice:
    """A slice of a buy lot consumed by a sell, in the quantity the sell took from it"""

    buy: models.Trade
    sell: models.Trade
    quantity: Decimal


@dataclass
class LotMatches:
    """
    Result of FIFO-matching buy and sell trades.

    `open_lots` holds whatever quantity is left unsold, keyed by asset with all
    platforms and accounts merged, since positions are tracked per asset only.
    `slices` holds every sell's consumed pieces, in the order they were matched.
    """

    open_lots: dict[str, list[OpenLot]]
    slices: list[LotSlice]


class UnmatchedSellError(Exception):
    """Raised when a sell's quantity exceeds the open lots available to match it"""

    def __init__(
        self,
        asset: str,
        platform: str,
        account: str,
        sell_id: str,
        unmatched_quantity: Decimal,
    ) -> None:
        self.asset = asset
        self.platform = platform
        self.account = account
        self.sell_id = sell_id
        self.unmatched_quantity = unmatched_quantity
        super().__init__(
            f"Sell {sell_id} for asset={asset} platform={platform} account={account} "
            f"has {unmatched_quantity} unmatched quantity with no open lots remaining"
        )


def match_lots(trades: list[models.Trade]) -> LotMatches:
    """
    FIFO-matches buy and sell trades into lot slices.

    Trades are grouped by (asset, platform, account) so a Roth lot is never consumed by
    a brokerage sell and a lot on one platform is never consumed by a sell on another.
    Excluded trades are skipped entirely. Within a group, trades are processed in
    (date, action) order with same-day buys applied before sells, so a same-day rebuy
    can't fund the sale that paid for it. Sells consume open lots oldest-first, splitting
    the last lot consumed when the sell lands mid-lot. A sell that outruns its group's
    open lots raises UnmatchedSellError rather than inventing a zero-basis slice.
    """
    groups: dict[tuple[str, str, str], list[models.Trade]] = defaultdict(list)
    for trade in trades:
        if trade.excluded:
            continue
        groups[(trade.asset, trade.platform, trade.account)].append(trade)

    open_lots_by_asset: dict[str, list[OpenLot]] = defaultdict(list)
    slices: list[LotSlice] = []

    for (asset, _platform, _account), group_trades in groups.items():
        group_open_lots: list[OpenLot] = []

        for trade in sorted(group_trades, key=_sort_key):
            if trade.action == models.TradeAction.BUY:
                group_open_lots.append(OpenLot(buy=trade, quantity=trade.quantity))
                continue

            slices.extend(_consume_sell(sell=trade, open_lots=group_open_lots))

        open_lots_by_asset[asset].extend(group_open_lots)

    return LotMatches(open_lots=dict(open_lots_by_asset), slices=slices)


def _consume_sell(sell: models.Trade, open_lots: list[OpenLot]) -> list[LotSlice]:
    """Consumes a group's open lots oldest-first for one sell, splitting the last lot"""
    remaining = sell.quantity
    consumed_slices: list[LotSlice] = []

    while remaining > 0 and open_lots:
        lot = open_lots[0]

        if lot.quantity <= remaining:
            consumed_slices.append(
                LotSlice(buy=lot.buy, sell=sell, quantity=lot.quantity)
            )
            remaining -= lot.quantity
            open_lots.pop(0)
        else:
            consumed_slices.append(LotSlice(buy=lot.buy, sell=sell, quantity=remaining))
            lot.quantity -= remaining
            remaining = Decimal(0)

    if remaining > 0:
        raise UnmatchedSellError(
            asset=sell.asset,
            platform=sell.platform,
            account=sell.account,
            sell_id=sell.id,
            unmatched_quantity=remaining,
        )

    return consumed_slices


def _sort_key(trade: models.Trade) -> tuple[datetime.date, int]:
    """Sort key for a group's trades: by date, with same-day BUYs ordered before SELLs"""
    action_order = 0 if trade.action == models.TradeAction.BUY else 1
    return (_trade_date(trade), action_order)


def _trade_date(trade: models.Trade) -> datetime.date:
    """Normalizes a trade's date; tests may build trades with ISO date strings"""
    return datetime.date.fromisoformat(str(trade.date))
