import click
import datetime
import pandas as pd
from decimal import Decimal
from backend.database import crud, models, connection
from backend.scrapers import prices, trades
from backend.config import config, logger
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.config import InvalidPriceResponse


def _get_date_range(start_date: datetime.date, end_date: datetime.date) -> list[str]:
    """
    Given a date object of the last run, returns a list of date strings for each day
    between the last run and the current date
    """
    days_diff = (end_date - start_date).days
    target_dates = [
        start_date + datetime.timedelta(days=i) for i in range(0, days_diff + 1)
    ]
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

    try:
        previous_prices = prices.get_previous_asset_prices(db, target_dates)
        crud.store_historical_prices(db, previous_prices)
    except InvalidPriceResponse as e:
        e.log_error()
        raise


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
    last_ibkr_trade_date = (
        db.query(func.max(models.Trade.date))
        .filter(models.Trade.platform == "ibkr")
        .scalar()
    )
    last_coinbase_trade_date = (
        db.query(func.max(models.Trade.date))
        .filter(models.Trade.platform == "coinbase")
        .scalar()
    )
    assert last_ibkr_trade_date and last_coinbase_trade_date, (
        "No trades present, please seed DB first"
    )

    try:
        logger.info(f"Checking for stock trades since {last_ibkr_trade_date}...")
        stock_trades = trades.get_recent_ibkr_trades(
            db=db, start_date=last_ibkr_trade_date
        )
        logger.info(f"Found {len(stock_trades)} stock trades")
    except Exception as e:
        logger.error(f"Failed to scrape stock trades: {e}")
        stock_trades = []

    try:
        logger.info(f"Checking for crypto trades since {last_coinbase_trade_date}...")
        crypto_trades = trades.get_recent_coinbase_trades(
            start_date=last_coinbase_trade_date
        )
        logger.info(f"Found {len(crypto_trades)} crypto trades")
    except Exception as e:
        logger.error(f"Failed to scrape crypto trades: {e}")
        crypto_trades = []

    logger.info("Writing trades to DB")
    all_trades = stock_trades + crypto_trades
    crud.store_trades(db, all_trades)

    logger.info("Updating current position")
    positions = crud.build_positions_from_trades(db)
    crud.store_positions(db, positions)

    logger.info("Done")


def _get_next_vanguard_id(db: Session) -> int:
    """Returns the next sequential vanguard trade ID number"""
    last_id = (
        db.query(models.Trade.id)
        .filter(models.Trade.id.like("vanguard-%"))
        .order_by(models.Trade.id.desc())
        .limit(100)
        .all()
    )
    max_n = max(int(row.id.split("-")[1]) for row in last_id)
    return max_n + 1


def index_backdoor_roth_trades(db: Session):
    """Reads trades from backdoor_roths/ CSVs and inserts them into the DB"""
    backdoor_dir = config.trades_data_dir / "backdoor_roths"
    csv_files = sorted(backdoor_dir.glob("*.csv"))
    if not csv_files:
        logger.info("No backdoor roth CSVs found")
        return

    dfs = [pd.read_csv(f) for f in csv_files]
    trades_df = pd.concat(dfs, ignore_index=True)

    next_id = _get_next_vanguard_id(db)
    trade_objects = []
    for _, row in trades_df.iterrows():
        trade = models.Trade(
            id=f"vanguard-{next_id}",
            platform=row["platform"],
            date=row["date"],
            action=row["action"],
            asset=row["asset"],
            price=Decimal(str(row["price"])),
            quantity=Decimal(str(row["quantity"])),
            fees=Decimal(str(row["fees"])),
            cost=Decimal(str(row["cost"])),
            value=Decimal(str(row["value"])),
            excluded=False,
        )
        trade_objects.append(trade)
        next_id += 1

    logger.info(f"Inserting {len(trade_objects)} backdoor roth trades (vanguard-{next_id - len(trade_objects)} to vanguard-{next_id - 1})")
    crud.store_trades(db, trade_objects)

    logger.info("Updating current position")
    positions = crud.build_positions_from_trades(db)
    crud.store_positions(db, positions)
    logger.info("Done")


@click.command()
@click.option("--trades", "run_trades", is_flag=True, help="Index recent trades")
@click.option("--prices", "run_prices", is_flag=True, help="Fill historical prices")
@click.option("--positions", "run_positions", is_flag=True, help="Fill historical positions")
@click.option("--backdoor-roth", "run_backdoor_roth", is_flag=True, help="Index backdoor roth trades from CSVs")
def main(run_trades: bool, run_prices: bool, run_positions: bool, run_backdoor_roth: bool):
    with connection.SessionLocal() as db:
        if run_trades:
            index_recent_trades(db)
        if run_prices:
            _fill_historical_prices(db)
        if run_positions:
            _fill_historical_positions(db)
        if run_backdoor_roth:
            index_backdoor_roth_trades(db)


if __name__ == "__main__":
    main()
