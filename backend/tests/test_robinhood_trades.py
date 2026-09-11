from decimal import Decimal

import pytest

from backend.config import Config
from backend.scrapers import trades


def _activity(**overrides) -> dict:
    activity = {
        "id": "abc-123",
        "type": "BUY",
        "symbol": {"symbol": "VOO"},
        "price": 500.0,
        "units": 2.0,
        "fee": 0.0,
        "amount": -1000.0,
        "trade_date": "2026-09-10T14:30:00.000Z",
    }
    return {**activity, **overrides}


def test_buy_maps_to_a_trade():
    trade = trades._build_robinhood_trade(_activity())

    assert trade.id == "robinhood-abc-123"
    assert trade.platform == "robinhood"
    assert trade.date == "2026-09-10"
    assert trade.action == "BUY"
    assert trade.asset == "VOO"
    assert trade.price == Decimal("500")
    assert trade.quantity == Decimal("2")
    assert trade.cost == Decimal("1000")
    assert trade.value == Decimal("1000")


def test_sell_uses_positive_quantity():
    trade = trades._build_robinhood_trade(
        _activity(type="SELL", units=-2.0, amount=999.0, fee=1.0)
    )

    assert trade.action == "SELL"
    assert trade.quantity == Decimal("2")
    assert trade.fees == Decimal("1")
    assert trade.cost == Decimal("999")


def test_dividend_reinvestment_maps_to_a_buy():
    trade = trades._build_robinhood_trade(
        _activity(type="REI", units=0.1, amount=None, fee=0.25)
    )

    assert trade.action == "BUY"
    assert trade.quantity == Decimal("0.1")
    assert trade.cost == Decimal("50.25")


def test_missing_amount_on_a_sell_subtracts_fees():
    trade = trades._build_robinhood_trade(
        _activity(type="SELL", units=-2.0, amount=None, fee=1.0)
    )

    assert trade.cost == Decimal("999")


def test_missing_fee_defaults_to_zero():
    trade = trades._build_robinhood_trade(_activity(fee=None))

    assert trade.fees == Decimal("0")


def test_date_only_timestamps_are_kept():
    trade = trades._build_robinhood_trade(_activity(trade_date="2026-09-10"))

    assert trade.date == "2026-09-10"


def test_after_hours_utc_timestamp_uses_the_market_date():
    trade = trades._build_robinhood_trade(
        _activity(trade_date="2026-09-11T00:30:00.000Z")
    )

    assert trade.date == "2026-09-10"


def test_untracked_tickers_are_skipped():
    activities = [_activity(), _activity(id="xyz-789", symbol={"symbol": "NOTREAL"})]

    tracked = [
        activity for activity in activities if trades._is_tracked_activity(activity)
    ]
    assert [activity["id"] for activity in tracked] == ["abc-123"]


def test_missing_symbol_is_untracked():
    assert trades._is_tracked_activity(_activity(symbol=None)) is False


def test_get_recent_robinhood_trades_returns_empty_when_snaptrade_not_configured(
    monkeypatch,
):
    monkeypatch.setattr(Config, "snaptrade_configured", False)

    assert trades.get_recent_robinhood_trades(start_date=None) == []


def test_get_recent_robinhood_trades_returns_empty_when_not_connected(monkeypatch):
    monkeypatch.setattr(Config, "snaptrade_configured", True)
    monkeypatch.setattr(trades.robinhood, "get_client", lambda: "client")
    monkeypatch.setattr(trades.robinhood, "get_connection", lambda client: None)

    assert trades.get_recent_robinhood_trades(start_date=None) == []


def test_get_recent_robinhood_trades_raises_when_connection_is_disabled(monkeypatch):
    monkeypatch.setattr(Config, "snaptrade_configured", True)
    monkeypatch.setattr(trades.robinhood, "get_client", lambda: "client")
    monkeypatch.setattr(
        trades.robinhood,
        "get_connection",
        lambda client: {"id": "conn-1", "disabled": True},
    )

    with pytest.raises(trades.robinhood.RobinhoodDisconnectedError):
        trades.get_recent_robinhood_trades(start_date=None)


def test_missing_fee_key_defaults_to_zero():
    activity = _activity()
    del activity["fee"]

    assert trades._build_robinhood_trade(activity).fees == Decimal("0")


def test_missing_amount_key_falls_back_to_the_trade_value():
    activity = _activity()
    del activity["amount"]

    assert trades._build_robinhood_trade(activity).cost == Decimal("1000")


def test_null_trade_date_is_skipped():
    assert trades._build_robinhood_trade(_activity(trade_date=None)) is None


def test_unknown_activity_type_is_skipped():
    assert trades._build_robinhood_trade(_activity(type="SPLIT")) is None


def test_lowercase_sell_is_skipped_rather_than_read_as_a_buy():
    assert trades._build_robinhood_trade(_activity(type="sell", units=-2.0)) is None


def test_sell_with_positive_units_is_skipped():
    assert trades._build_robinhood_trade(_activity(type="SELL", units=2.0)) is None


def test_one_unusable_activity_does_not_drop_the_batch(monkeypatch):
    activities = [
        _activity(),
        _activity(id="bad-456", trade_date=None),
        _activity(id="ghi-789", units=1.0, amount=-500.0),
    ]

    monkeypatch.setattr(Config, "snaptrade_configured", True)
    monkeypatch.setattr(trades.robinhood, "get_client", lambda: "client")
    monkeypatch.setattr(
        trades.robinhood,
        "get_connection",
        lambda client: {"id": "conn-1", "disabled": False},
    )
    monkeypatch.setattr(
        trades.robinhood, "get_account_id", lambda client, connection_id: "account-1"
    )
    monkeypatch.setattr(
        trades.robinhood,
        "get_activities",
        lambda client, account_id, start_date: activities,
    )

    scraped = trades.get_recent_robinhood_trades(start_date=None)
    assert [trade.id for trade in scraped] == ["robinhood-abc-123", "robinhood-ghi-789"]


def test_connection_without_a_disabled_flag_is_treated_as_live(monkeypatch):
    monkeypatch.setattr(Config, "snaptrade_configured", True)
    monkeypatch.setattr(trades.robinhood, "get_client", lambda: "client")
    monkeypatch.setattr(
        trades.robinhood, "get_connection", lambda client: {"id": "conn-1"}
    )
    monkeypatch.setattr(
        trades.robinhood, "get_account_id", lambda client, connection_id: "account-1"
    )
    monkeypatch.setattr(
        trades.robinhood, "get_activities", lambda client, account_id, start_date: []
    )

    assert trades.get_recent_robinhood_trades(start_date=None) == []
