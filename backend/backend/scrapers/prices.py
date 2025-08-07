from decimal import Decimal
import requests
from backend.config import config

STOCKS = ["COIN", "HOOD"]
ASSETS = ["bitcoin", "ethereum", "solana"]
COINGECKO_API = "https://api.coingecko.com/api/v3/simple/price"
FINHUB_API = "https://finnhub.io/api/v1/quote"


def _get_stock_price(asset: str) -> Decimal:
    """Gets the current market price for a stock or ETF"""
    params = {"symbol": asset, "token": config.finhub_api_token}
    response = requests.get(FINHUB_API, params=params)
    response_data: dict = response.json()
    return Decimal(response_data["c"])


def get_stock_prices() -> dict[str, Decimal]:
    """Gets the current market price for each stock or ETF"""
    return {asset: _get_stock_price(asset) for asset in STOCKS}


def get_crypto_prices() -> dict[str, Decimal]:
    """Gets the current market price for each crypt token"""
    params = {"ids": ",".join(ASSETS), "vs_currencies": "usd"}
    response = requests.get(COINGECKO_API, params=params)
    response_data: dict = response.json()
    return {asset: Decimal(price_info["usd"]) for asset, price_info in response_data.items()}
