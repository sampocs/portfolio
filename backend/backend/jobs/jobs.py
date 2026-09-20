import click
import datetime
import pandas as pd
from decimal import Decimal
from backend import alerts, lots
from backend.database import crud, models, connection
from backend.scrapers import prices, trades, robinhood
from backend.config import config, logger, Platform
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.config import InvalidPriceResponse

# A rebuild reaching back further than this is unusual enough to log loudly
SNAPSHOT_REBUILD_WARN_DAYS = 30


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


def rebuild_tax_lots(db: Session):
    """Rebuilds the tax_lots table from every trade, sharing the position matcher's FIFO"""
    all_trades = crud.get_trades(db)
    matches = lots.match_lots(all_trades)
    tax_lots = crud.build_tax_lots(matches)
    crud.store_tax_lots(db, tax_lots)
    logger.info(f"Rebuilt {len(tax_lots)} tax lot rows")


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


def _get_new_trades(
    db: Session, scraped_trades: list[models.Trade]
) -> list[models.Trade]:
    """
    Returns the scraped trades that aren't stored yet

    Each sync re-fetches from the last known trade date, so most scraped trades
    already exist and only the genuinely new ones can invalidate a snapshot
    """
    if not scraped_trades:
        return []

    scraped_ids = [trade.id for trade in scraped_trades]
    existing_ids = {
        row.id
        for row in db.query(models.Trade.id)
        .filter(models.Trade.id.in_(scraped_ids))
        .all()
    }

    return [trade for trade in scraped_trades if trade.id not in existing_ids]


def _clear_stale_position_snapshots(
    db: Session, new_trades: list[models.Trade]
) -> None:
    """
    Deletes the position snapshots dated on or after the earliest new trade

    Snapshots are written once per day and never revisited, so a trade that lands after
    its date's snapshot leaves a permanent gap in the performance chart. This always
    happens with robinhood, since SnapTrade publishes transactions a day late.
    The cleared dates are rebuilt from stored prices by _fill_historical_positions
    """
    if not new_trades:
        return

    # Trades are built with string dates, so they're parsed before comparing
    earliest_trade_date = min(
        datetime.date.fromisoformat(str(trade.date)) for trade in new_trades
    )
    last_snapshot_date = db.query(func.max(models.HistoricalPosition.date)).scalar()
    if not last_snapshot_date or earliest_trade_date > last_snapshot_date:
        return

    # A span of months means the trade history was pulled from much further back than a
    # normal sync reaches, and every day in it gets recomputed, so it's worth surfacing
    # The span is inclusive of both ends: clearing a single date rebuilds one day
    rebuild_days = (last_snapshot_date - earliest_trade_date).days + 1
    log_rebuild = (
        logger.warning if rebuild_days > SNAPSHOT_REBUILD_WARN_DAYS else logger.info
    )
    log_rebuild(
        f"Rebuilding {rebuild_days} days of position snapshots from {earliest_trade_date}"
    )

    # Deliberately left uncommitted - _rebuild_stale_position_snapshots commits the
    # delete together with the refill that repairs it
    db.query(models.HistoricalPosition).filter(
        models.HistoricalPosition.date >= earliest_trade_date
    ).delete()


def _rebuild_stale_position_snapshots(
    db: Session, new_trades: list[models.Trade]
) -> None:
    """
    Clears the snapshots invalidated by late trades and refills them in one transaction

    The refill re-derives each cleared date from stored trades and prices and can fail
    (e.g. a missing price row, or a zero-cost transfer-in), so the delete must never be
    committed on its own - that would leave a hole in the performance chart that every
    subsequent run reopens
    """
    try:
        _clear_stale_position_snapshots(db, new_trades)
        _fill_historical_positions(db)
        db.commit()
    except Exception:
        db.rollback()
        raise


def index_recent_trades(db: Session, send_alerts: bool = False):
    """
    Checks for any recent stock, crypto, or robinhood trades and saves them in the database
    :param send_alerts: Whether a broken robinhood connection should push a notification.
                        Only the scheduled run sets this - the app's sync endpoint runs
                        far more often and would notify repeatedly
    """
    last_ibkr_trade_date = (
        db.query(func.max(models.Trade.date))
        .filter(models.Trade.platform == Platform.IBKR.value)
        .scalar()
    )
    last_coinbase_trade_date = (
        db.query(func.max(models.Trade.date))
        .filter(models.Trade.platform == Platform.COINBASE.value)
        .scalar()
    )
    assert last_ibkr_trade_date and last_coinbase_trade_date, (
        "No trades present, please seed DB first"
    )

    # Robinhood is intentionally left out of the assert above: there are no robinhood
    # trades until the first one syncs, and a missing date pulls the full history
    last_robinhood_trade_date = (
        db.query(func.max(models.Trade.date))
        .filter(models.Trade.platform == Platform.ROBINHOOD.value)
        .scalar()
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

    try:
        logger.info(
            f"Checking for robinhood trades since {last_robinhood_trade_date}..."
        )
        robinhood_trades = trades.get_recent_robinhood_trades(
            start_date=last_robinhood_trade_date
        )
        logger.info(f"Found {len(robinhood_trades)} robinhood trades")
    except robinhood.RobinhoodDisconnectedError:
        logger.error("Robinhood connection is disabled and must be re-authorized")
        robinhood_trades = []
        if send_alerts:
            alerts.send_robinhood_disconnected_alert()
    except Exception as e:
        logger.error(f"Failed to scrape robinhood trades: {e}")
        robinhood_trades = []

    all_trades = stock_trades + crypto_trades + robinhood_trades

    # New trades are identified up front, while the DB can still tell them apart from
    # what it holds. They're then stored, and the snapshots they invalidate are
    # cleared and refilled afterward
    new_trades = _get_new_trades(db, all_trades)

    logger.info("Writing trades to DB")
    crud.store_trades(db, all_trades)

    _rebuild_stale_position_snapshots(db, new_trades)

    logger.info("Updating current position")
    positions = crud.build_positions_from_trades(db)
    crud.store_positions(db, positions)

    logger.info("Rebuilding tax lots")
    rebuild_tax_lots(db)

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
            account=models.TradeAccount.ROTH.value,
        )
        trade_objects.append(trade)
        next_id += 1

    # Resolved before the write, since every trade looks stored once it has been inserted
    new_trades = _get_new_trades(db, trade_objects)

    logger.info(
        f"Inserting {len(trade_objects)} backdoor roth trades (vanguard-{next_id - len(trade_objects)} to vanguard-{next_id - 1})"
    )
    crud.store_trades(db, trade_objects)

    # These are backdated trades, so their snapshots have to be rebuilt too
    _rebuild_stale_position_snapshots(db, new_trades)

    logger.info("Updating current position")
    positions = crud.build_positions_from_trades(db)
    crud.store_positions(db, positions)

    logger.info("Rebuilding tax lots")
    rebuild_tax_lots(db)

    logger.info("Done")


@click.command()
@click.option("--trades", "run_trades", is_flag=True, help="Index recent trades")
@click.option("--prices", "run_prices", is_flag=True, help="Fill historical prices")
@click.option(
    "--positions", "run_positions", is_flag=True, help="Fill historical positions"
)
@click.option(
    "--backdoor-roth",
    "run_backdoor_roth",
    is_flag=True,
    help="Index backdoor roth trades from CSVs",
)
@click.option("--tax-lots", "run_tax_lots", is_flag=True, help="Rebuild tax lots")
def main(
    run_trades: bool,
    run_prices: bool,
    run_positions: bool,
    run_backdoor_roth: bool,
    run_tax_lots: bool,
):
    with connection.SessionLocal() as db:
        if run_trades:
            index_recent_trades(db)
        if run_prices:
            _fill_historical_prices(db)
        if run_positions:
            _fill_historical_positions(db)
        if run_backdoor_roth:
            index_backdoor_roth_trades(db)
        if run_tax_lots:
            rebuild_tax_lots(db)


if __name__ == "__main__":
    main()
