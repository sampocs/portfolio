import pandas as pd
from decimal import Decimal
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from backend.database import connection, models, crud
from backend.config import config
from backend.scrapers import prices


def backfill_trades():
    """Seeds trades table with backfilled trades"""
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
    crypto_df = pd.read_csv(config.prices_data_dir / "crypto_clean.csv")
    stock_df = pd.read_csv(config.prices_data_dir / "stocks_clean.csv")
    trades_df = pd.concat([crypto_df, stock_df], ignore_index=True)

    trades_df["price"] = trades_df["price"].astype(str).map(lambda x: Decimal(x))

    records = trades_df.to_dict("records")

    with connection.engine.begin() as conn:
        stmt = insert(models.HistoricalPrice).values(records)
        stmt = stmt.on_conflict_do_nothing(index_elements=["asset", "date"])
        conn.execute(stmt)


def populate_live_prices(db: Session):
    """Queries and saves the current price for each asset"""
    price_dict = prices.get_all_current_asset_prices()
    crud.store_live_prices(db, price_dict)


def main():
    models.Base.metadata.create_all(connection.engine)
    backfill_trades()
    backfill_prices()

    with connection.SessionLocal() as db:
        crud.build_position_from_trades(db)
        populate_live_prices(db)


if __name__ == "__main__":
    main()
