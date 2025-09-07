from decimal import Decimal
import pandas as pd
import click
from urllib import parse
from backend.config import config, PriceType
from backend.bootstrap import seed
from backend.database import connection, models
from sqlalchemy.dialects.postgresql import insert


def get_crypto_prices(asset: str) -> pd.DataFrame:
    """Crypto prices are read from the coingecko CSV downloads"""
    raw_data_path = config.project_home / "data" / "prices" / "raw" / f"{asset}_raw.csv"
    assert (
        raw_data_path.exists()
    ), f"Please download historical crypto prices for {asset} from coingecko. See readme for instructions."

    df = pd.read_csv(raw_data_path)

    df["asset"] = asset
    df["date"] = df["snapped_at"].str.slice(0, 10)

    df = df[["asset", "date", "price"]]
    df = df.sort_values(["date", "asset"]).reset_index(drop=True)

    return df


def get_stock_prices(asset: str) -> pd.DataFrame:
    """Stock prices are queried from alpha vantage"""
    alpha_vantage_params = {
        "function": "TIME_SERIES_DAILY",
        "outputsize": "full",
        "datatype": "csv",
        "apikey": config.alpha_vantage_api_token,
    }
    params = parse.urlencode(dict(**alpha_vantage_params, **{"symbol": asset}))
    df = pd.read_csv(f"{config.alpha_price_api}?{params}")

    df["asset"] = asset
    df["date"] = df["timestamp"]
    df["price"] = df["close"]

    df = df[["asset", "date", "price"]]
    df = df.sort_values(["date", "asset"]).reset_index(drop=True)

    return df


@click.command()
@click.option("--asset", required=True, help="The asset to add (e.g., AAPL, BTC).")
def main(asset: str):
    """
    Adds an asset to the system for price tracking.
    """
    price_type = config.assets[asset].price_type
    prices_df = get_crypto_prices(asset) if price_type == PriceType.CRYPTO else get_stock_prices(asset)

    prices_df["price"] = prices_df["price"].astype(str).map(lambda x: Decimal(x))
    prices_df["date"] = pd.to_datetime(prices_df["date"]).dt.date
    prices_df = seed.forward_fill_missing_prices(prices_df)

    records = prices_df.to_dict("records")

    with connection.engine.begin() as conn:
        stmt = insert(models.HistoricalPrice).values(records)
        stmt = stmt.on_conflict_do_nothing(index_elements=["asset", "date"])
        conn.execute(stmt)


if __name__ == "__main__":
    main()
