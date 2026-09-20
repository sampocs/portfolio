import datetime
import logging

from backend.config import config
from backend.database import crud, models
from backend.jobs import jobs
from backend.scrapers import trades
from tests import factories


def _seed_existing_trades(db) -> None:
    """Seeds one existing ibkr and coinbase trade, required by index_recent_trades's assert"""
    db.add_all(
        [
            factories.make_trade(
                id="ibkr-existing", platform="ibkr", custodian="ibkr", asset="AAPL"
            ),
            factories.make_trade(
                id="coinbase-existing",
                platform="coinbase",
                custodian="coinbase",
                asset="BTC",
            ),
        ]
    )
    db.commit()


def _stub_out_unrelated_steps(monkeypatch) -> None:
    """
    Stubs the downstream steps that aren't part of the sync-toggle behavior under test
    (snapshot rebuilding, position building, tax lot rebuilding), so the test isolates
    whether a disabled platform's scrape is skipped without needing to also satisfy
    their unrelated preconditions (seeded prices, matching asset config, etc.)
    """
    monkeypatch.setattr(
        jobs, "_rebuild_stale_position_snapshots", lambda db, new_trades: None
    )
    monkeypatch.setattr(crud, "build_positions_from_trades", lambda db: [])
    monkeypatch.setattr(crud, "store_positions", lambda db, positions: None)
    monkeypatch.setattr(jobs, "rebuild_tax_lots", lambda db: None)


def _new_trade(trade_id: str, platform: str, asset: str) -> models.Trade:
    return factories.make_trade(
        id=trade_id,
        platform=platform,
        custodian=platform,
        asset=asset,
        date=datetime.date(2026, 9, 15),
    )


def test_disabled_platform_scrape_is_skipped_while_others_still_run(
    db_session, monkeypatch, caplog
):
    _seed_existing_trades(db_session)
    _stub_out_unrelated_steps(monkeypatch)
    monkeypatch.setattr(config, "disabled_sync_platforms", {"ibkr"})

    monkeypatch.setattr(
        trades,
        "get_recent_ibkr_trades",
        lambda db, start_date: [_new_trade("ibkr-new", "ibkr", "AAPL")],
    )
    monkeypatch.setattr(
        trades,
        "get_recent_coinbase_trades",
        lambda start_date: [_new_trade("coinbase-new", "coinbase", "BTC")],
    )
    monkeypatch.setattr(
        trades,
        "get_recent_robinhood_trades",
        lambda start_date: [_new_trade("robinhood-new", "robinhood", "VOO")],
    )

    with caplog.at_level(logging.INFO, logger="portfolio"):
        jobs.index_recent_trades(db_session)

    # The disabled platform's scrape never ran, so its trade was never stored
    assert db_session.get(models.Trade, "ibkr-new") is None
    # The other platforms' scrapes ran normally and their trades were stored
    assert db_session.get(models.Trade, "coinbase-new") is not None
    assert db_session.get(models.Trade, "robinhood-new") is not None

    assert any(
        "ibkr" in record.message and "skip" in record.message.lower()
        for record in caplog.records
    )


def test_no_platforms_disabled_runs_every_scraper(db_session, monkeypatch):
    _seed_existing_trades(db_session)
    _stub_out_unrelated_steps(monkeypatch)
    monkeypatch.setattr(config, "disabled_sync_platforms", set())

    monkeypatch.setattr(
        trades,
        "get_recent_ibkr_trades",
        lambda db, start_date: [_new_trade("ibkr-new", "ibkr", "AAPL")],
    )
    monkeypatch.setattr(
        trades,
        "get_recent_coinbase_trades",
        lambda start_date: [_new_trade("coinbase-new", "coinbase", "BTC")],
    )
    monkeypatch.setattr(
        trades,
        "get_recent_robinhood_trades",
        lambda start_date: [_new_trade("robinhood-new", "robinhood", "VOO")],
    )

    jobs.index_recent_trades(db_session)

    assert db_session.get(models.Trade, "ibkr-new") is not None
    assert db_session.get(models.Trade, "coinbase-new") is not None
    assert db_session.get(models.Trade, "robinhood-new") is not None


def test_disabled_sync_platforms_does_not_remove_existing_rows(db_session, monkeypatch):
    """Disabling a platform skips its scrape but leaves its already-stored rows alone"""
    _seed_existing_trades(db_session)
    _stub_out_unrelated_steps(monkeypatch)
    monkeypatch.setattr(config, "disabled_sync_platforms", {"ibkr"})

    monkeypatch.setattr(trades, "get_recent_ibkr_trades", lambda db, start_date: [])
    monkeypatch.setattr(trades, "get_recent_coinbase_trades", lambda start_date: [])
    monkeypatch.setattr(trades, "get_recent_robinhood_trades", lambda start_date: [])

    jobs.index_recent_trades(db_session)

    assert db_session.get(models.Trade, "ibkr-existing") is not None
