import datetime
from decimal import Decimal
import requests
from sqlalchemy.orm import Session
from backend.config import config
from backend.database import models, crud


def _get_current_stock_price(asset: str) -> Decimal:
    """Gets the current market price for a stock or ETF"""
    params = {"symbol": asset, "token": config.finhub_api_token}
    response = requests.get(config.finhub_live_price_api, params=params)
    response_data: dict = response.json()
    return Decimal(str(response_data["c"]))


def _get_previous_stock_price(asset: str, days: int = 1) -> dict[str, Decimal]:
    """Gets the previous close price(s) for a stock or ETH"""
    current_date = datetime.date.today()
    target_dates = [str(current_date - datetime.timedelta(days=i)) for i in range(1, 1 + days)]

    params = {
        "function": "TIME_SERIES_DAILY",
        "symbol": asset,
        "outputsize": "compact",
        "datetype": "json",
        "apikey": config.alpha_vantage_api_token,
    }
    response = requests.get(config.alpha_prev_close_api, params=params)
    response_data: dict = response.json()

    assert response_data["Meta Data"]["3. Last Refreshed"] == str(current_date), "Previous stock data not refreshed yet"

    return {date: Decimal(response_data["Time Series (Daily)"][date]["4. close"]) for date in target_dates}


def _get_previous_crypto_price(asset: str, days: int = 1) -> dict[str, Decimal]:
    """Gets the previous close price(s) for a crypto token"""
    current_date = datetime.date.today()
    target_dates = [current_date - datetime.timedelta(days=i) for i in range(1, 1 + days)]

    def _close_date_to_unix(date: datetime.date) -> int:
        """The unix time for the close of June 1st is technically on June 2nd (at 00:00)"""
        start_of_target_date = datetime.datetime.combine(date, midnight, utc_tz)
        end_of_target_date = start_of_target_date + datetime.timedelta(days=1)
        return int(end_of_target_date.timestamp()) * 1000  # to milliseconds

    midnight = datetime.time.min
    utc_tz = datetime.timezone.utc
    date_to_unix = {str(date): _close_date_to_unix(date) for date in target_dates}

    params = {"vs_currency": "usd", "days": days, "interval": "daily"}
    coingecko_id = config.coingecko_ids[asset]
    response = requests.get(config.coingecko_prev_close_api.format(coingecko_id), params=params)
    response_data: dict = response.json()

    price_data = response_data["prices"]
    price_date_by_unix = {time_unix: price for time_unix, price in price_data}
    print(price_date_by_unix)
    print(date_to_unix)

    return {str(date): Decimal(str(price_date_by_unix[date_to_unix[str(date)]])) for date in target_dates}


def get_current_stock_prices() -> dict[str, Decimal]:
    """Gets the current market price for each stock or ETF"""
    return {asset: _get_current_stock_price(asset) for asset in config.stock_tickers}


def get_current_crypto_prices() -> dict[str, Decimal]:
    """Gets the current market price for each crypt token"""
    params = {"ids": ",".join(config.coingecko_ids.values()), "vs_currencies": "usd"}

    response = requests.get(config.coingecko_live_price_api, params=params)
    response_data: dict = response.json()

    return {asset: Decimal(str(response_data[config.coingecko_ids[asset]]["usd"])) for asset in config.crypto_tokens}


def get_previous_stock_prices() -> dict[str, dict[str, Decimal]]:
    """Gets the previous close prices for each stock"""
    return {asset: _get_previous_stock_price(asset) for asset in config.stock_tickers}


def get_previous_crypto_prices() -> dict[str, dict[str, Decimal]]:
    """Gets the previous close price for each crypto token"""
    return {asset: _get_previous_crypto_price(asset) for asset in config.crypto_tokens}


def get_all_current_asset_prices() -> dict[str, Decimal]:
    """Returns the price of each asset (crypto and stocks)"""
    return {**get_current_stock_prices(), **get_current_crypto_prices()}


def get_cached_asset_prices(db: Session) -> dict[str, Decimal]:
    """Fetches prices from the database, or queries the actual prices if the db is stale"""
    all_price_data = db.query(models.LivePrice).all()
    assert all_price_data, "No prices found"

    # The updated time should be the same for each asset, so we only have to check the first one
    last_fetched_time = all_price_data[0].updated_at.astimezone(datetime.timezone.utc)
    current_time = datetime.datetime.now(datetime.timezone.utc)
    ttl_length = datetime.timedelta(minutes=config.price_cache_ttl_min)
    price_is_fresh = current_time - last_fetched_time < ttl_length

    # If the price is fresh, just use the one from the DB
    if price_is_fresh:
        return {price_data.asset: price_data.price for price_data in all_price_data}

    # Otherwise fetch new prices, cache them and then return them
    price_data_dict = get_all_current_asset_prices()
    crud.store_live_prices(db, price_data_dict)

    return price_data_dict
