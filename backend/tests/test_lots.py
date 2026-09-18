from decimal import Decimal

import pytest

from backend import lots
from backend.database import models


def _trade(**overrides) -> models.Trade:
    defaults = {
        "id": "t-1",
        "platform": "ibkr",
        "date": "2026-01-01",
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
    buy_1 = _trade(id="b-1", date="2026-01-01", quantity=Decimal("10"))
    buy_2 = _trade(id="b-2", date="2026-01-02", quantity=Decimal("10"))
    sell = _trade(
        id="s-1",
        date="2026-01-03",
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
    buy_1 = _trade(id="b-1", date="2026-01-01", quantity=Decimal("5"))
    buy_2 = _trade(id="b-2", date="2026-01-02", quantity=Decimal("5"))
    buy_3 = _trade(id="b-3", date="2026-01-03", quantity=Decimal("5"))
    sell = _trade(
        id="s-1",
        date="2026-01-04",
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
        date="2026-01-01",
        quantity=Decimal("10"),
        account=models.TradeAccount.BROKERAGE.value,
    )
    buy_roth = _trade(
        id="b-roth",
        date="2026-01-01",
        quantity=Decimal("10"),
        account=models.TradeAccount.ROTH.value,
    )
    sell_brokerage = _trade(
        id="s-brok",
        date="2026-01-02",
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


def test_lots_pooled_per_platform_ibkr_not_consumed_by_vanguard_sell():
    buy_ibkr = _trade(
        id="b-ibkr", date="2026-01-01", quantity=Decimal("10"), platform="ibkr"
    )
    buy_vanguard = _trade(
        id="b-van", date="2026-01-01", quantity=Decimal("10"), platform="vanguard"
    )
    sell_vanguard = _trade(
        id="s-van",
        date="2026-01-02",
        action=models.TradeAction.SELL.value,
        quantity=Decimal("10"),
        platform="vanguard",
    )

    matches = lots.match_lots([buy_ibkr, buy_vanguard, sell_vanguard])

    assert matches.slices == [
        lots.LotSlice(buy=buy_vanguard, sell=sell_vanguard, quantity=Decimal("10"))
    ]
    assert matches.open_lots == {
        "AAPL": [lots.OpenLot(buy=buy_ibkr, quantity=Decimal("10"))]
    }


def test_same_day_buy_is_not_consumed_by_the_sell_that_funded_it():
    older_buy = _trade(id="b-old", date="2026-01-01", quantity=Decimal("5"))
    same_day_buy = _trade(id="b-new", date="2026-01-02", quantity=Decimal("5"))
    same_day_sell = _trade(
        id="s-1",
        date="2026-01-02",
        action=models.TradeAction.SELL.value,
        quantity=Decimal("5"),
    )

    # Trades are passed out of chronological order to prove the matcher sorts by
    # (date, action) itself rather than relying on input order
    matches = lots.match_lots([same_day_sell, same_day_buy, older_buy])

    assert matches.slices == [
        lots.LotSlice(buy=older_buy, sell=same_day_sell, quantity=Decimal("5"))
    ]
    assert matches.open_lots == {
        "AAPL": [lots.OpenLot(buy=same_day_buy, quantity=Decimal("5"))]
    }


def test_excluded_trades_are_ignored():
    buy = _trade(id="b-1", date="2026-01-01", quantity=Decimal("10"))
    excluded_sell = _trade(
        id="s-excluded",
        date="2026-01-02",
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
    buy = _trade(id="b-1", date="2026-01-01", quantity=Decimal("5"))
    sell = _trade(
        id="s-1",
        date="2026-01-02",
        action=models.TradeAction.SELL.value,
        quantity=Decimal("8"),
    )

    with pytest.raises(lots.UnmatchedSellError) as excinfo:
        lots.match_lots([buy, sell])

    error = excinfo.value
    assert error.asset == "AAPL"
    assert error.platform == "ibkr"
    assert error.account == models.TradeAccount.BROKERAGE.value
    assert error.sell_id == "s-1"
    assert error.unmatched_quantity == Decimal("3")
