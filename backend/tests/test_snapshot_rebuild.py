import datetime
from decimal import Decimal

import pytest
import sqlalchemy
from sqlalchemy.orm import Session, sessionmaker

from backend.database import models
from backend.jobs import jobs


@pytest.fixture
def db():
    engine = sqlalchemy.create_engine("sqlite:///:memory:")
    models.Base.metadata.create_all(engine)
    with sessionmaker(bind=engine)() as session:
        yield session


def _trade(trade_id: str, date: str) -> models.Trade:
    return models.Trade(
        id=trade_id,
        platform="robinhood",
        date=date,
        action="BUY",
        asset="VOO",
        price=Decimal("500"),
        quantity=Decimal("1"),
        fees=Decimal("0"),
        cost=Decimal("500"),
        value=Decimal("500"),
        excluded=False,
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


def test_only_unstored_trades_are_new(db):
    _seed(db, _trade("robinhood-1", "2026-09-10"))

    scraped = [_trade("robinhood-1", "2026-09-10"), _trade("robinhood-2", "2026-09-11")]
    assert [trade.id for trade in jobs._get_new_trades(db, scraped)] == ["robinhood-2"]


def test_late_trade_clears_snapshots_from_its_date(db):
    _seed(db, _snapshot("2026-09-09"), _snapshot("2026-09-10"), _snapshot("2026-09-11"))

    jobs._clear_stale_position_snapshots(db, [_trade("robinhood-2", "2026-09-10")])

    remaining = [row.date for row in db.query(models.HistoricalPosition).all()]
    assert remaining == [datetime.date(2026, 9, 9)]


def test_trade_after_the_last_snapshot_clears_nothing(db):
    _seed(db, _snapshot("2026-09-09"), _snapshot("2026-09-10"))

    jobs._clear_stale_position_snapshots(db, [_trade("robinhood-2", "2026-09-11")])

    assert db.query(models.HistoricalPosition).count() == 2


def test_no_snapshots_clears_nothing(db):
    jobs._clear_stale_position_snapshots(db, [_trade("robinhood-2", "2026-09-11")])

    assert db.query(models.HistoricalPosition).count() == 0


def test_no_new_trades_clears_nothing(db):
    _seed(db, _snapshot("2026-09-10"))

    jobs._clear_stale_position_snapshots(db, [])

    assert db.query(models.HistoricalPosition).count() == 1
