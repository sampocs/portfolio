import datetime
from decimal import Decimal

from backend.database import models
from backend.scrapers import trades
from tests import factories


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
    assert trade.custodian == "ibkr"
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


SELL_DATE = datetime.date(2026, 9, 18)


def _ibkr_sell(**overrides) -> models.Trade:
    defaults = {
        "id": trades._ibkr_trade_id("HOOD_2026-09-18_SELL"),
        "platform": "ibkr",
        "date": SELL_DATE,
        "action": models.TradeAction.SELL.value,
        "asset": "HOOD",
        "price": Decimal("113.677548"),
        "quantity": Decimal("37.5467"),
        "cost": Decimal("4268.216795"),
        "value": Decimal("4268.216795"),
    }
    return factories.make_trade(**{**defaults, **overrides})


def test_first_fill_of_the_day_gets_the_base_id(db_session):
    resolved = trades.resolve_ibkr_trade_id(db_session, new_trade=_ibkr_sell(id="unset"))

    assert resolved == trades._ibkr_trade_id("HOOD_2026-09-18_SELL")


def test_refetched_fill_reuses_its_row_despite_a_same_day_sale_on_another_platform(
    db_session,
):
    stored = _ibkr_sell()
    vanguard_sale = _ibkr_sell(
        id="vanguard-501",
        platform="vanguard",
        price=Decimal("119.19"),
        quantity=Decimal("10"),
        cost=Decimal("1191.9"),
        value=Decimal("1191.9"),
    )
    db_session.add_all([stored, vanguard_sale])
    db_session.commit()

    resolved = trades.resolve_ibkr_trade_id(db_session, new_trade=_ibkr_sell(id="unset"))

    assert resolved == stored.id


def test_refetched_fill_with_settlement_drift_reuses_its_row(db_session):
    stored = _ibkr_sell()
    db_session.add(stored)
    db_session.commit()

    drifted = _ibkr_sell(id="unset", quantity=Decimal("37.5470"), price=Decimal("113.68"))
    resolved = trades.resolve_ibkr_trade_id(db_session, new_trade=drifted)

    assert resolved == stored.id


def test_distinct_second_fill_on_the_same_day_gets_a_suffixed_id(db_session):
    db_session.add(_ibkr_sell())
    db_session.commit()

    second_fill = _ibkr_sell(
        id="unset",
        quantity=Decimal("5"),
        price=Decimal("110"),
        cost=Decimal("550"),
        value=Decimal("550"),
    )
    resolved = trades.resolve_ibkr_trade_id(db_session, new_trade=second_fill)

    assert resolved == trades._ibkr_trade_id("HOOD_2026-09-18_SELL_5_110_550_550")
    assert resolved != trades._ibkr_trade_id("HOOD_2026-09-18_SELL")


def test_same_day_buy_does_not_affect_a_sell(db_session):
    db_session.add(_ibkr_sell(id="buy-row", action=models.TradeAction.BUY.value))
    db_session.commit()

    resolved = trades.resolve_ibkr_trade_id(db_session, new_trade=_ibkr_sell(id="unset"))

    assert resolved == trades._ibkr_trade_id("HOOD_2026-09-18_SELL")


def test_refetch_of_an_excluded_fill_is_dropped(db_session):
    db_session.add(_ibkr_sell(excluded=True))
    db_session.commit()

    resolved = trades.resolve_ibkr_trade_id(db_session, new_trade=_ibkr_sell(id="unset"))

    assert resolved is None


def test_distinct_fill_does_not_take_an_excluded_fill_base_id(db_session):
    db_session.add(_ibkr_sell(excluded=True))
    db_session.commit()

    second_fill = _ibkr_sell(
        id="unset",
        quantity=Decimal("5"),
        price=Decimal("110"),
        cost=Decimal("550"),
        value=Decimal("550"),
    )
    resolved = trades.resolve_ibkr_trade_id(db_session, new_trade=second_fill)

    assert resolved == trades._ibkr_trade_id("HOOD_2026-09-18_SELL_5_110_550_550")
