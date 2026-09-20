import datetime
from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from backend.database import models
from backend.jobs import jobs
from tests import factories


def _trade(trade_id: str, date: str) -> models.Trade:
    """A robinhood buy, which is what arrives late enough to invalidate a snapshot"""
    return factories.make_trade(
        id=trade_id,
        platform="robinhood",
        date=date,
        asset="VOO",
        price=Decimal("500"),
        quantity=Decimal("1"),
        cost=Decimal("500"),
        value=Decimal("500"),
    )


def _snapshot(date: str) -> models.HistoricalPosition:
    return models.HistoricalPosition(
        asset="VOO",
        date=date,
        average_position_price=Decimal("500"),
        daily_close_price=Decimal("500"),
        quantity=Decimal("1"),
        cost=Decimal("500"),
        value=Decimal("500"),
        returns=Decimal("0"),
    )


def _seed(db: Session, *rows: models.Trade | models.HistoricalPosition) -> None:
    """
    Persists setup rows for a test

    SQLite's Date column rejects plain strings (unlike the app's real Postgres DB, which
    parses them), so string dates are coerced to `datetime.date` before insert. Rows handed
    straight to the functions under test are left untouched, since those must keep their
    scraper-shaped string dates to exercise the parsing in `_clear_stale_position_snapshots`.
    """
    for row in rows:
        if isinstance(row.date, str):
            row.date = datetime.date.fromisoformat(row.date)

    db.add_all(rows)
    db.commit()


def test_only_unstored_trades_are_new(db_session):
    _seed(db_session, _trade(trade_id="robinhood-1", date="2026-09-10"))

    scraped = [_trade(trade_id="robinhood-1", date="2026-09-10"), _trade(trade_id="robinhood-2", date="2026-09-11")]
    assert [trade.id for trade in jobs._get_new_trades(db_session, scraped)] == ["robinhood-2"]


def test_late_trade_clears_snapshots_from_its_date(db_session):
    _seed(db_session, _snapshot("2026-09-09"), _snapshot("2026-09-10"), _snapshot("2026-09-11"))

    jobs._clear_stale_position_snapshots(db_session, [_trade(trade_id="robinhood-2", date="2026-09-10")])

    remaining = [row.date for row in db_session.query(models.HistoricalPosition).all()]
    assert remaining == [datetime.date(2026, 9, 9)]


def test_trade_after_the_last_snapshot_clears_nothing(db_session):
    _seed(db_session, _snapshot("2026-09-09"), _snapshot("2026-09-10"))

    jobs._clear_stale_position_snapshots(db_session, [_trade(trade_id="robinhood-2", date="2026-09-11")])

    assert db_session.query(models.HistoricalPosition).count() == 2


def test_no_snapshots_clears_nothing(db_session):
    jobs._clear_stale_position_snapshots(db_session, [_trade(trade_id="robinhood-2", date="2026-09-11")])

    assert db_session.query(models.HistoricalPosition).count() == 0


def test_no_new_trades_clears_nothing(db_session):
    _seed(db_session, _snapshot("2026-09-10"))

    jobs._clear_stale_position_snapshots(db_session, [])

    assert db_session.query(models.HistoricalPosition).count() == 1


def test_failed_refill_leaves_snapshots_intact(db_session, monkeypatch):
    _seed(db_session, _snapshot("2026-09-09"), _snapshot("2026-09-10"), _snapshot("2026-09-11"))

    def failing_refill(session: Session) -> None:
        raise AssertionError("Daily close price not found for VOO on 2026-09-10")

    monkeypatch.setattr(jobs, "_fill_historical_positions", failing_refill)

    with pytest.raises(AssertionError):
        jobs._rebuild_stale_position_snapshots(
            db_session, [_trade(trade_id="robinhood-2", date="2026-09-10")]
        )

    remaining = [
        row.date
        for row in db_session.query(models.HistoricalPosition)
        .order_by(models.HistoricalPosition.date)
        .all()
    ]
    assert remaining == [
        datetime.date(2026, 9, 9),
        datetime.date(2026, 9, 10),
        datetime.date(2026, 9, 11),
    ]
