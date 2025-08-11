import datetime
from backend.database import crud, models
from backend.scrapers import prices
from backend.config import logger
from sqlalchemy.orm import Session
from sqlalchemy import func


def _get_date_range(start_date: datetime.date, end_date: datetime.date) -> list[str]:
    """
    Given a date object of the last run, returns a list of date strings for each day
    between the last run and the current date
    """
    days_diff = (end_date - start_date).days
    target_dates = [start_date + datetime.timedelta(days=i) for i in range(0, days_diff + 1)]
    return [str(date) for date in target_dates]


def _fill_historical_prices(db: Session):
    """
    Fetches and stores the previous close prices since the last one stored,
    up to the current date
    """
    last_updated_date = db.query(func.max(models.HistoricalPrice.date)).scalar()
    assert last_updated_date, "No historical prices found, please seed DB first"

    start_date = last_updated_date + datetime.timedelta(days=1)
    end_date = datetime.date.today() - datetime.timedelta(days=1)
    if start_date > end_date:
        logger.info("Prices already updated")
        return

    target_dates = _get_date_range(start_date=start_date, end_date=end_date)
    logger.info(f"Filling historical prices from {start_date} to {end_date}...")

    previous_prices = prices.get_previous_asset_prices(db, target_dates)
    crud.store_historical_prices(db, previous_prices)


def _fill_historical_positions(db: Session):
    """
    Fetches and stores the historical position snapshots for each day since
    the last one stored in the DB, up to the latest date that we have price data
    """
    last_updated_date = db.query(func.max(models.HistoricalPosition.date)).scalar()
    if not last_updated_date:
        last_updated_date = db.query(func.min(models.Trade.date)).scalar()
        assert last_updated_date, "No trades present, please seed DB first"

    last_price_date = db.query(func.max(models.HistoricalPrice.date)).scalar()
    assert last_price_date, "No historical prices present, please seed DB first"

    start_date = last_updated_date + datetime.timedelta(days=1)
    end_date = last_price_date
    if start_date > end_date:
        logger.info("Positions already updated")
        return

    target_dates = _get_date_range(start_date=start_date, end_date=end_date)
    logger.info(f"Filling historical positions from {start_date} to {end_date}...")

    historical_positions = crud.build_historical_positions(db, target_dates)
    crud.store_historical_positions(db, historical_positions)


def fill_prices_and_positions(db: Session):
    """
    Bundles the price and position updates into the same job to make sure prices are
    updated before we snapshot positions
    """
    logger.info("Filling historical prices...")
    _fill_historical_prices(db)
    logger.info("Done")

    logger.info("Filling historical positions...")
    _fill_historical_positions(db)
    logger.info("Done")


def index_recent_trades(db: Session):
    """
    Checks for any recent crypto or stock trades and saves them in the database
    """
    logger.info("Checking for recent stock trades...")
    logger.info("No new stock trades found")
    logger.info("Checking for recent crypto trades...")
    logger.info("No new crypto trades found")
    # TODO
    return
