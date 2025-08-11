import datetime
import pandas as pd
from decimal import Decimal
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.database import connection, models, crud
from backend.config import config, logger
from backend.scrapers import prices


def forward_fill_missing_prices(trades_df: pd.DataFrame) -> pd.DataFrame:
    """Fill any missing prices from the trade DF with the previous known price"""
    filled_dfs = []
    for asset in trades_df["asset"].unique():
        asset_df = trades_df[trades_df["asset"] == asset].copy()

        # Create complete dateframe with all dates from min to max date for this asset
        date_range = pd.date_range(start=asset_df["date"].min(), end=trades_df["date"].max(), freq="D")
        complete_df = pd.DataFrame({"asset": asset, "date": date_range.date})

        # Merge with existing data and forward fill prices
        asset_complete_df = complete_df.merge(asset_df, on=["asset", "date"], how="left")
        asset_complete_df["price"] = asset_complete_df["price"].ffill()

        filled_dfs.append(asset_complete_df)

    return pd.concat(filled_dfs, ignore_index=True)


def backfill_trades():
    """Seeds trades table with backfilled trades"""
    logger.info("Backfilling trades...")

    vanguard_df = pd.read_csv(config.trades_data_dir / "vanguard_clean.csv")
    coinbase_df = pd.read_csv(config.trades_data_dir / "coinbase_clean.csv")
    trades_df = pd.concat([vanguard_df, coinbase_df], ignore_index=True)

    for col in ["price", "quantity", "fees", "cost", "value"]:
        trades_df[col] = trades_df[col].astype(str).map(lambda x: Decimal(x))

    records = trades_df.to_dict("records")

    with connection.engine.begin() as conn:
        stmt = insert(models.Trade).values(records)
        stmt = stmt.on_conflict_do_nothing(index_elements=["id"])
        conn.execute(stmt)


def backfill_prices():
    """Seeds prices table with historical prices"""
    logger.info("Backfilling prices...")

    crypto_df = pd.read_csv(config.prices_data_dir / "crypto_clean.csv")
    stock_df = pd.read_csv(config.prices_data_dir / "stocks_clean.csv")
    trades_df = pd.concat([crypto_df, stock_df], ignore_index=True)

    trades_df["price"] = trades_df["price"].astype(str).map(lambda x: Decimal(x))
    trades_df["date"] = pd.to_datetime(trades_df["date"]).dt.date
    trades_df = forward_fill_missing_prices(trades_df)

    records = trades_df.to_dict("records")

    with connection.engine.begin() as conn:
        stmt = insert(models.HistoricalPrice).values(records)
        stmt = stmt.on_conflict_do_nothing(index_elements=["asset", "date"])
        conn.execute(stmt)


def populate_live_prices(db: Session):
    """Queries and saves the current price for each asset"""
    logger.info("Populating live prices...")
    price_dict = prices.get_current_asset_prices()
    crud.store_live_prices(db, price_dict)


def populate_position(db: Session):
    """Populates the current position"""
    logger.info("Populating current positions...")
    end_date = db.query(func.max(models.Trade.date)).scalar()
    assert end_date, "Please load trades before populating position"

    positions = crud.build_positions_from_trades(db, end_date=end_date)
    crud.store_positions(db, positions)


def backfill_historical_positions(db: Session):
    """Backfills position snapshots for each date"""
    logger.info("Backfilling position snapshots...")
    start_date = db.query(func.min(models.Trade.date)).scalar()
    end_date = db.query(func.max(models.HistoricalPrice.date)).scalar()
    target_dates = [str(start_date + datetime.timedelta(days=i)) for i in range(1, (end_date - start_date).days)]

    historical_positions = crud.build_historical_positions(db, target_dates, log_progress=True)
    crud.store_historical_positions(db, historical_positions)


def main():
    models.Base.metadata.create_all(connection.engine)
    backfill_trades()
    backfill_prices()

    with connection.SessionLocal() as db:
        populate_position(db)
        populate_live_prices(db)
        backfill_historical_positions(db)


if __name__ == "__main__":
    main()
