import datetime
import hashlib
from decimal import Decimal

from ibind import IbkrClient
from backend.config import config, Platform
from backend.database import models, crud
from coinbase.rest import RESTClient
from sqlalchemy.orm import Session

# IBKR transactions don't carry a commission field, so fees are estimated per share
IBKR_FEE_PER_SHARE = Decimal("0.0035")


def resolve_ibkr_trade_id(db: Session, new_trade: models.Trade) -> str | None:
    """
    IBKR transactions carry no stable ID, so a trade's ID is a hash of its asset, date,
    and action, and the sync re-fetches from the last trade date every run. The same
    fill therefore comes back on later runs, sometimes with values that drift slightly
    as the order settles, and it must upsert onto its existing row rather than insert
    a second one.

    Only IBKR rows are candidates: a same-day trade recorded by hand for another
    platform (a Vanguard sale, say) shares the asset/date bucket but can never share an
    ID with an IBKR fill. If an existing IBKR row for the same action matches within
    tolerance, its ID is reused, or None if that row was excluded by hand, since
    re-inserting it would undo the exclusion. Otherwise a genuinely distinct second
    fill on the same day gets a value-suffixed ID so it doesn't overwrite the first.
    """
    same_day_fills = [
        existing
        for existing in crud.get_trades(
            db, asset=new_trade.asset, date=new_trade.date, include_excluded=True
        )
        if existing.platform == Platform.IBKR.value
        and existing.action == new_trade.action
    ]

    for existing in same_day_fills:
        if _is_same_fill(existing=existing, candidate=new_trade):
            return None if existing.excluded else existing.id

    base_id = _ibkr_trade_id(f"{new_trade.asset}_{new_trade.date}_{new_trade.action}")
    if any(existing.id == base_id for existing in same_day_fills):
        suffix = f"{new_trade.quantity}_{new_trade.price}_{new_trade.cost}_{new_trade.value}"
        return _ibkr_trade_id(
            f"{new_trade.asset}_{new_trade.date}_{new_trade.action}_{suffix}"
        )

    return base_id


def _is_same_fill(existing: models.Trade, candidate: models.Trade) -> bool:
    """Whether two same-day trades are the same fill, allowing for settlement drift"""
    if existing.quantity == 0 or existing.price == 0:
        return False

    tolerance = Decimal("0.0001")
    qty_diff_pct = abs(existing.quantity - candidate.quantity) / abs(existing.quantity)
    price_diff_pct = abs(existing.price - candidate.price) / existing.price
    return qty_diff_pct <= tolerance and price_diff_pct <= tolerance


def get_recent_ibkr_trades(
    db: Session, start_date: datetime.date
) -> list[models.Trade]:
    """
    Scrapes recent IBKR trades
    :param start_date: First date to query orders from, inclusively
    """
    client = IbkrClient(**config.ibind_client_params)
    client.tickle()

    trades = []
    for asset_info in config.assets.values():
        if asset_info.platform != Platform.IBKR:
            continue

        contract_id = asset_info.contract_id
        assert contract_id, f"Contract ID not provided for {asset_info.asset}"

        current_date = datetime.date.today()
        days = (current_date - start_date).days + 1

        transactions_raw = client.transaction_history(
            config.ibkr_account_id,
            contract_id,
            "USD",
            days,  # type: ignore
        )
        if not transactions_raw.data or "transactions" not in transactions_raw.data:
            continue
        transactions: list[dict[str, str | int]] = transactions_raw.data["transactions"]  # type: ignore

        for transaction in transactions:
            if transaction["type"] not in ["Buy", "Sell"]:
                continue

            trade = _build_ibkr_trade(transaction, asset=asset_info.asset)

            # Re-fetched fills upsert onto their existing row; only a distinct
            # same-day fill gets a fresh ID, and an excluded fill is left alone
            trade_id = resolve_ibkr_trade_id(db, new_trade=trade)
            if trade_id is None:
                continue

            trade.id = trade_id
            trades.append(trade)

    return trades


def _build_ibkr_trade(transaction: dict, asset: str) -> models.Trade:
    """
    Converts an IBKR transaction into a trade

    IBKR reports a sell's quantity as negative, but the action already carries the
    direction, so the quantity is normalized to positive like every other platform.
    The lot matcher relies on this - it rejects sells with a non-positive quantity
    """
    action = str(transaction["type"]).upper()
    quantity = abs(Decimal(str(transaction["qty"])))
    cost = abs(Decimal(str(transaction["amt"])))
    price = Decimal(str(transaction["pr"]))
    date = datetime.datetime.strptime(str(transaction["rawDate"]), "%Y%m%d").strftime(
        "%Y-%m-%d"
    )

    # Note: This intentionally causes trades on the same day for the same asset have the same ID
    # We handle these cases separately, which are rare since the main user of this product
    # does not place multiple trades for the same asset in the same day
    return models.Trade(
        id=_ibkr_trade_id(f"{asset}_{date}_{action}"),
        platform=Platform.IBKR.value,
        date=date,
        action=action,
        asset=asset,
        price=price,
        quantity=quantity,
        fees=IBKR_FEE_PER_SHARE * quantity,
        cost=cost,
        value=price * quantity,
        excluded=False,
        account=models.TradeAccount.BROKERAGE.value,
    )


def _ibkr_trade_id(id_string: str) -> str:
    return f"ibkr-{hashlib.sha256(id_string.encode()).hexdigest()[:20]}"


def get_recent_coinbase_trades(start_date: datetime.date) -> list[models.Trade]:
    """
    Scrapes recent coinbase trades since the last specified date
    :param start_date: First date to query orders from, inclusively
    """
    client = RESTClient(
        api_key=config.coinbase_api_key, api_secret=config.coinbase_api_secret
    )

    trades = []
    orders = client.list_orders(
        order_status=["FILLED"],
        start_date=f"{start_date.isoformat()}T00:00:00.000000000Z",
    )
    for order in orders["orders"]:
        if order["product_id"] not in [
            f"{asset}-USD" for asset in config.crypto_tokens
        ]:
            continue

        asset = order["product_id"].replace("-USD", "")
        trade_id = f"coinbase-{order['order_id']}"
        date = str(order["last_fill_time"])[:10]

        trade = models.Trade(
            id=trade_id,
            platform=Platform.COINBASE.value,
            date=date,
            action=str(order["side"]),
            asset=asset,
            price=Decimal(str(order["average_filled_price"])),
            quantity=Decimal(str(order["filled_size"])),
            fees=Decimal(str(order["total_fees"])),
            cost=Decimal(str(order["total_value_after_fees"])),
            value=Decimal(str(order["filled_value"])),
            excluded=False,
            account=models.TradeAccount.BROKERAGE.value,
        )

        trades.append(trade)

    return trades
