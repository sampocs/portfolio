import datetime
from decimal import Decimal

import pytest

from backend import lots
from backend.database import models


def _trade(**overrides) -> models.Trade:
    defaults = {
        "id": "t-1",
        "platform": "ibkr",
        "custodian": "ibkr",
        "date": datetime.date(2026, 1, 1),
        "action": models.TradeAction.BUY.value,
        "asset": "AAPL",
        "price": Decimal("100"),
        "quantity": Decimal("10"),
        "fees": Decimal("0"),
        "cost": Decimal("1000"),
        "value": Decimal("1000"),
        "excluded": False,
        "account": models.TradeAccount.BROKERAGE.value,
    }
    return models.Trade(**{**defaults, **overrides})


def test_fifo_consumes_oldest_lot_first_and_splits_partial_sell():
    buy_1 = _trade(id="b-1", date=datetime.date(2026, 1, 1), quantity=Decimal("10"))
    buy_2 = _trade(id="b-2", date=datetime.date(2026, 1, 2), quantity=Decimal("10"))
    sell = _trade(
        id="s-1",
        date=datetime.date(2026, 1, 3),
        action=models.TradeAction.SELL.value,
        quantity=Decimal("15"),
    )

    matches = lots.match_lots([buy_1, buy_2, sell])

    assert matches.slices == [
        lots.LotSlice(buy=buy_1, sell=sell, quantity=Decimal("10")),
        lots.LotSlice(buy=buy_2, sell=sell, quantity=Decimal("5")),
    ]
    assert matches.open_lots == {
        "AAPL": [lots.OpenLot(buy=buy_2, quantity=Decimal("5"))]
    }


def test_sell_spanning_several_lots_yields_one_slice_per_lot():
    buy_1 = _trade(id="b-1", date=datetime.date(2026, 1, 1), quantity=Decimal("5"))
    buy_2 = _trade(id="b-2", date=datetime.date(2026, 1, 2), quantity=Decimal("5"))
    buy_3 = _trade(id="b-3", date=datetime.date(2026, 1, 3), quantity=Decimal("5"))
    sell = _trade(
        id="s-1",
        date=datetime.date(2026, 1, 4),
        action=models.TradeAction.SELL.value,
        quantity=Decimal("12"),
    )

    matches = lots.match_lots([buy_1, buy_2, buy_3, sell])

    assert matches.slices == [
        lots.LotSlice(buy=buy_1, sell=sell, quantity=Decimal("5")),
        lots.LotSlice(buy=buy_2, sell=sell, quantity=Decimal("5")),
        lots.LotSlice(buy=buy_3, sell=sell, quantity=Decimal("2")),
    ]
    assert matches.open_lots == {
        "AAPL": [lots.OpenLot(buy=buy_3, quantity=Decimal("3"))]
    }


def test_lots_pooled_per_account_roth_not_consumed_by_brokerage_sell():
    buy_brokerage = _trade(
        id="b-brok",
        date=datetime.date(2026, 1, 1),
        quantity=Decimal("10"),
        account=models.TradeAccount.BROKERAGE.value,
    )
    buy_roth = _trade(
        id="b-roth",
        date=datetime.date(2026, 1, 1),
        quantity=Decimal("10"),
        account=models.TradeAccount.ROTH.value,
    )
    sell_brokerage = _trade(
        id="s-brok",
        date=datetime.date(2026, 1, 2),
        action=models.TradeAction.SELL.value,
        quantity=Decimal("10"),
        account=models.TradeAccount.BROKERAGE.value,
    )

    matches = lots.match_lots([buy_brokerage, buy_roth, sell_brokerage])

    assert matches.slices == [
        lots.LotSlice(buy=buy_brokerage, sell=sell_brokerage, quantity=Decimal("10"))
    ]
    # The Roth lot is untouched and still open, merged into the asset-level dict
    assert matches.open_lots == {
        "AAPL": [lots.OpenLot(buy=buy_roth, quantity=Decimal("10"))]
    }


def test_lots_pooled_per_custodian_ibkr_not_consumed_by_vanguard_sell():
    # Both buys share the same platform on purpose, so this fails if grouping ever
    # reverts to (asset, platform, account) instead of (asset, custodian, account)
    buy_ibkr = _trade(
        id="b-ibkr",
        date=datetime.date(2026, 1, 1),
        quantity=Decimal("10"),
        platform="ibkr",
        custodian="ibkr",
    )
    buy_vanguard = _trade(
        id="b-van",
        date=datetime.date(2026, 1, 1),
        quantity=Decimal("10"),
        platform="ibkr",
        custodian="vanguard",
    )
    sell_vanguard = _trade(
        id="s-van",
        date=datetime.date(2026, 1, 2),
        action=models.TradeAction.SELL.value,
        quantity=Decimal("10"),
        platform="vanguard",
        custodian="vanguard",
    )

    matches = lots.match_lots([buy_ibkr, buy_vanguard, sell_vanguard])

    assert matches.slices == [
        lots.LotSlice(buy=buy_vanguard, sell=sell_vanguard, quantity=Decimal("10"))
    ]
    assert matches.open_lots == {
        "AAPL": [lots.OpenLot(buy=buy_ibkr, quantity=Decimal("10"))]
    }


def test_sell_consumes_a_transferred_lot_at_its_new_custodian():
    # Bought at Vanguard, then transferred to Robinhood: the buy's platform stays
    # "vanguard" (where it happened) but its custodian is now "robinhood" (where the
    # shares sit). The Robinhood sell must consume it despite the platform mismatch.
    transferred_buy = _trade(
        id="b-van",
        date=datetime.date(2026, 1, 1),
        quantity=Decimal("10"),
        platform="vanguard",
        custodian="robinhood",
    )
    robinhood_sell = _trade(
        id="s-rh",
        date=datetime.date(2026, 1, 2),
        action=models.TradeAction.SELL.value,
        quantity=Decimal("10"),
        platform="robinhood",
        custodian="robinhood",
    )

    matches = lots.match_lots([transferred_buy, robinhood_sell])

    # The slice keeps the original buy trade, so its cost basis and acquisition date
    # survive the transfer intact
    assert matches.slices == [
        lots.LotSlice(buy=transferred_buy, sell=robinhood_sell, quantity=Decimal("10"))
    ]
    assert matches.open_lots == {"AAPL": []}


def test_same_day_buy_is_not_consumed_by_the_sell_that_funded_it():
    older_buy = _trade(
        id="b-old", date=datetime.date(2026, 1, 1), quantity=Decimal("5")
    )
    same_day_buy = _trade(
        id="b-new", date=datetime.date(2026, 1, 2), quantity=Decimal("5")
    )
    same_day_sell = _trade(
        id="s-1",
        date=datetime.date(2026, 1, 2),
        action=models.TradeAction.SELL.value,
        quantity=Decimal("5"),
    )

    # Trades are passed out of chronological order to prove the matcher sorts by
    # (date, action, id) itself rather than relying on input order
    matches = lots.match_lots([same_day_sell, same_day_buy, older_buy])

    assert matches.slices == [
        lots.LotSlice(buy=older_buy, sell=same_day_sell, quantity=Decimal("5"))
    ]
    assert matches.open_lots == {
        "AAPL": [lots.OpenLot(buy=same_day_buy, quantity=Decimal("5"))]
    }


def test_excluded_trades_are_ignored():
    buy = _trade(id="b-1", date=datetime.date(2026, 1, 1), quantity=Decimal("10"))
    excluded_sell = _trade(
        id="s-excluded",
        date=datetime.date(2026, 1, 2),
        action=models.TradeAction.SELL.value,
        quantity=Decimal("5"),
        excluded=True,
    )

    matches = lots.match_lots([buy, excluded_sell])

    assert matches.slices == []
    assert matches.open_lots == {
        "AAPL": [lots.OpenLot(buy=buy, quantity=Decimal("10"))]
    }


def test_sell_that_outruns_its_lots_raises_unmatched_sell_error():
    buy = _trade(id="b-1", date=datetime.date(2026, 1, 1), quantity=Decimal("5"))
    sell = _trade(
        id="s-1",
        date=datetime.date(2026, 1, 2),
        action=models.TradeAction.SELL.value,
        quantity=Decimal("8"),
    )

    with pytest.raises(lots.UnmatchedSellError) as excinfo:
        lots.match_lots([buy, sell])

    error = excinfo.value
    assert error.asset == "AAPL"
    assert error.custodian == "ibkr"
    assert error.account == models.TradeAccount.BROKERAGE.value
    assert error.sell_id == "s-1"
    assert error.unmatched_quantity == Decimal("3")


def test_sell_with_non_positive_quantity_raises_value_error():
    sell = _trade(
        id="s-1",
        date=datetime.date(2026, 1, 2),
        action=models.TradeAction.SELL.value,
        quantity=Decimal("0"),
    )

    with pytest.raises(ValueError):
        lots.match_lots([sell])


def test_same_day_buys_break_ties_on_id_regardless_of_input_order():
    # Both buys land on the same date, at different prices, so nothing but id can
    # order them; the sell only partially drains the first-consumed lot
    buy_low_id = _trade(
        id="b-1", date=datetime.date(2026, 1, 1), price=Decimal("86.36")
    )
    buy_high_id = _trade(
        id="b-2", date=datetime.date(2026, 1, 1), price=Decimal("86.17")
    )
    sell = _trade(
        id="s-1",
        date=datetime.date(2026, 1, 2),
        action=models.TradeAction.SELL.value,
        quantity=Decimal("6"),
    )

    matches_low_first = lots.match_lots([buy_low_id, buy_high_id, sell])
    matches_high_first = lots.match_lots([buy_high_id, buy_low_id, sell])

    expected_slices = [
        lots.LotSlice(buy=buy_low_id, sell=sell, quantity=Decimal("6")),
    ]
    expected_open_lots = {
        "AAPL": [
            lots.OpenLot(buy=buy_low_id, quantity=Decimal("4")),
            lots.OpenLot(buy=buy_high_id, quantity=Decimal("10")),
        ]
    }

    assert matches_low_first.slices == expected_slices
    assert matches_low_first.open_lots == expected_open_lots
    assert matches_high_first.slices == expected_slices
    assert matches_high_first.open_lots == expected_open_lots
