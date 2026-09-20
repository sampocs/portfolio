from decimal import Decimal

from backend.database import crud, models
from tests import factories


def test_store_trades_sets_custodian_on_insert(db_session):
    trade = factories.make_trade(id="t-1", custodian="robinhood")

    crud.store_trades(db_session, [trade])

    stored = db_session.get(models.Trade, "t-1")
    assert stored.custodian == "robinhood"


def test_store_trades_carries_forward_a_transferred_custodian_on_reupsert(db_session):
    # Simulates a trade that was originally scraped at ibkr, then moved to robinhood
    # by the replatform command
    transferred = factories.make_trade(
        id="t-1", platform="ibkr", custodian="robinhood", price=Decimal("100")
    )
    crud.store_trades(db_session, [transferred])

    # The scraper re-fetches its rolling window and rebuilds the same trade id with
    # custodian == platform, unaware the shares were ever moved
    rescraped = factories.make_trade(
        id="t-1", platform="ibkr", custodian="ibkr", price=Decimal("150")
    )
    crud.store_trades(db_session, [rescraped])

    stored = db_session.get(models.Trade, "t-1")
    assert stored.custodian == "robinhood"
    # Non-custodian fields still update normally from the re-scrape
    assert stored.price == Decimal("150")


def test_store_trades_sets_custodian_for_a_genuinely_new_trade_alongside_an_existing_one(
    db_session,
):
    existing = factories.make_trade(id="t-1", platform="ibkr", custodian="robinhood")
    crud.store_trades(db_session, [existing])

    new_trade = factories.make_trade(
        id="t-2", platform="coinbase", custodian="coinbase"
    )
    crud.store_trades(db_session, [existing, new_trade])

    stored_existing = db_session.get(models.Trade, "t-1")
    stored_new = db_session.get(models.Trade, "t-2")
    assert stored_existing.custodian == "robinhood"
    assert stored_new.custodian == "coinbase"


def test_store_trades_does_nothing_for_an_empty_list(db_session):
    crud.store_trades(db_session, [])

    assert db_session.query(models.Trade).count() == 0
