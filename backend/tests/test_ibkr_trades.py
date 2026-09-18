from decimal import Decimal

from backend.scrapers import trades


def _transaction(**overrides) -> dict:
    transaction = {
        "type": "Buy",
        "qty": 2.8131,
        "amt": -499.993,
        "pr": 177.737372,
        "rawDate": "20260401",
    }
    return {**transaction, **overrides}


def test_buy_maps_to_a_trade():
    trade = trades._build_ibkr_trade(_transaction(), asset="COIN")

    assert trade.platform == "ibkr"
    assert trade.date == "2026-04-01"
    assert trade.action == "BUY"
    assert trade.asset == "COIN"
    assert trade.price == Decimal("177.737372")
    assert trade.quantity == Decimal("2.8131")
    assert trade.fees == Decimal("0.0035") * Decimal("2.8131")
    assert trade.cost == Decimal("499.993")
    assert trade.value == Decimal("177.737372") * Decimal("2.8131")


def test_sell_uses_positive_quantity():
    trade = trades._build_ibkr_trade(
        _transaction(type="Sell", qty=-99.4192, amt=2261.778416, pr=22.749916),
        asset="GLXY",
    )

    assert trade.action == "SELL"
    assert trade.quantity == Decimal("99.4192")
    assert trade.fees == Decimal("0.0035") * Decimal("99.4192")
    assert trade.cost == Decimal("2261.778416")
    assert trade.value == Decimal("22.749916") * Decimal("99.4192")


def test_same_day_trades_share_an_id_per_action():
    buy = trades._build_ibkr_trade(_transaction(), asset="COIN")
    second_buy = trades._build_ibkr_trade(_transaction(qty=1.0), asset="COIN")
    sell = trades._build_ibkr_trade(_transaction(type="Sell", qty=-1.0), asset="COIN")

    assert buy.id == second_buy.id
    assert buy.id != sell.id
    assert buy.id.startswith("ibkr-")
