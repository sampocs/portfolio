import datetime
from decimal import Decimal
import requests
from sqlalchemy.orm import Session
from backend.config import config, InvalidPriceResponse
from backend.database import models, crud


def _get_previous_stock_price(asset: str, target_dates: list[str]) -> dict[str, Decimal]:
    """
    Gets the previous close price(s) for a stock or ETH
    Returns a mapping of date -> price for the asset
    For weekends and holidays, a price will not be found, and the returning dict will be missing
    that price key
    """
    params = {
        "function": "TIME_SERIES_DAILY",
        "symbol": asset,
        "outputsize": "compact",
        "datetype": "json",
        "apikey": config.alpha_vantage_api_token,
    }
    response = requests.get(config.alpha_prev_close_api, params=params)
    response_data: dict = response.json()

    if "Time Series (Daily)" not in response_data:
        raise InvalidPriceResponse(price_type="previous", source="AlphaVantage", response_data=response_data)

    daily_prices = response_data["Time Series (Daily)"]

    return {date: Decimal(daily_prices[date]["4. close"]) for date in target_dates if date in daily_prices}


def _get_previous_crypto_price(asset: str, target_dates: list[str]) -> dict[str, Decimal]:
    """
    Gets the previous close price(s) for a crypto token
    Returns a mapping of date -> price for the asset
    """

    def _close_date_to_unix(date: str) -> int:
        """The unix time for the close of June 1st is technically on June 2nd (at 00:00)"""
        start_of_target_date = datetime.datetime.combine(datetime.date.fromisoformat(date), midnight, utc_tz)
        end_of_target_date = start_of_target_date + datetime.timedelta(days=1)
        return int(end_of_target_date.timestamp()) * 1000  # to milliseconds

    midnight = datetime.time.min
    utc_tz = datetime.timezone.utc
    date_to_unix = {date: _close_date_to_unix(date) for date in target_dates}

    params = {"vs_currency": "usd", "days": len(target_dates) + 1, "interval": "daily"}
    coingecko_id = config.coingecko_ids[asset]
    response = requests.get(config.coingecko_prev_close_api.format(coingecko_id), params=params)
    response_data: dict = response.json()

    if "prices" not in response_data:
        raise InvalidPriceResponse(price_type="previous", source="Coingecko", response_data=response_data)

    price_data = response_data["prices"]
    price_by_unix_date = {time_unix: str(price) for (time_unix, price) in price_data}

    return {date: Decimal(price_by_unix_date[date_to_unix[date]]) for date in target_dates}


def _get_current_stock_price(asset: str) -> Decimal:
    """Gets the current market price for a stock or ETF"""
    params = {"symbol": asset, "token": config.finhub_api_token}
    response = requests.get(config.finhub_live_price_api, params=params)
    response_data: dict = response.json()

    if "c" not in response_data:
        raise InvalidPriceResponse(price_type="current", source="FinHub", response_data=response_data)

    return Decimal(str(response_data["c"]))


def _get_current_stock_prices() -> dict[str, Decimal]:
    """Gets the current market price for each stock or ETF"""
    return {asset: _get_current_stock_price(asset) for asset in config.stock_tickers}


def _get_current_crypto_prices() -> dict[str, Decimal]:
    """Gets the current market price for each crypt token"""
    params = {"ids": ",".join(config.coingecko_ids.values()), "vs_currencies": "usd"}

    response = requests.get(config.coingecko_live_price_api, params=params)
    response_data: dict = response.json()

    if not all(config.coingecko_ids[asset] in response_data for asset in config.crypto_tokens):
        raise InvalidPriceResponse(price_type="current", source="Coingecko", response_data=response_data)

    return {asset: Decimal(str(response_data[config.coingecko_ids[asset]]["usd"])) for asset in config.crypto_tokens}


def get_previous_asset_prices(db: Session, target_dates: list[str]) -> dict[str, dict[str, Decimal]]:
    """
    Gets the previous close prices for each stock
    Returns a mapping of asset -> date -> price
    """
    stock_prices = {asset: _get_previous_stock_price(asset, target_dates) for asset in config.stock_tickers}
    crypto_prices = {asset: _get_previous_crypto_price(asset, target_dates) for asset in config.crypto_tokens}
    all_prices = {**stock_prices, **crypto_prices}

    # Fill missing dates with previous prices from database
    # This is relevant for stocks which don't have prices when the market is closed on weekends and holidays
    for asset in all_prices.keys():
        for date in target_dates:
            if date not in all_prices[asset]:
                all_prices[asset][date] = crud.get_latest_asset_price(db, asset=asset, date=date)
    return all_prices


def get_current_asset_prices() -> dict[str, Decimal]:
    """Returns the price of each asset (crypto and stocks)"""
    return {**_get_current_stock_prices(), **_get_current_crypto_prices()}


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
    latest_prices = {price_data.asset: price_data.price for price_data in all_price_data}
    if price_is_fresh:
        return latest_prices

    # Otherwise fetch new prices, cache them and then return them
    # If the price query fails (possibly due to the rate limit, just return the stale prices)
    try:
        price_data_dict = get_current_asset_prices()
        crud.store_live_prices(db, price_data_dict)
        return price_data_dict
    except InvalidPriceResponse as e:
        e.log_error()

    return latest_prices
