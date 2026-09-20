import datetime

from backend.database import crud, models
from tests import factories


def test_get_trades_returns_trades_in_date_order(db_session):
    # Insert out of order: the asset page replays these FIFO in the order the API
    # returns them, so a sell arriving before its buys would corrupt the holdings
    db_session.add_all(
        [
            factories.make_trade(id="t-late", date=datetime.date(2026, 3, 1)),
            factories.make_trade(id="t-early", date=datetime.date(2026, 1, 1)),
            factories.make_trade(id="t-mid", date=datetime.date(2026, 2, 1)),
        ]
    )
    db_session.commit()

    trades = crud.get_trades(db_session, asset="AAPL")

    assert [trade.id for trade in trades] == ["t-early", "t-mid", "t-late"]


def test_get_trades_orders_same_day_buys_before_sells(db_session):
    # Ids are broker hashes, so lexical id order is meaningless: pick ids where it
    # would put the sell first, and assert the action tie-break wins
    db_session.add_all(
        [
            factories.make_trade(id="a-sell", action=models.TradeAction.SELL.value),
            factories.make_trade(id="z-buy"),
        ]
    )
    db_session.commit()

    trades = crud.get_trades(db_session, asset="AAPL")

    assert [trade.id for trade in trades] == ["z-buy", "a-sell"]
