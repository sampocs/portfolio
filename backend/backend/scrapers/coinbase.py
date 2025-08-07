from coinbase.rest import RESTClient
from backend.config import config
from backend.database import models
from datetime import datetime
from decimal import Decimal

_client: RESTClient = None  # type: ignore

assets = ["BTC", "SOL", "ETH"]


def _get_client() -> RESTClient:
    """Retreives an IBKR singleton client"""
    global _client
    if _client is None:
        _client = RESTClient(api_key=config.coinbase_api_key, api_secret=config.coinbase_api_secret)
    return _client


def get_current_holdings() -> list[models.Position]:
    """Retrieves current coinbase holdings"""
    client = _get_client()

    portfolio = client.get_portfolio_breakdown(config.coinbase_account_id).to_dict()

    positions = []
    for position in portfolio["breakdown"]["spot_positions"]:
        asset = position["asset"]
        if asset not in assets:
            continue

        quantity = position["total_balance_crypto"]
        average_price = position["average_entry_price"]["value"]
        cost = float(position["cost_basis"]["value"])
        value = float(position["total_balance_fiat"])

        returns = (value - cost) / cost * 100

        positions.append(
            models.Position(
                asset=asset,
                updated_at=datetime.now(),
                current_price=Decimal(0),
                average_price=Decimal(average_price),
                quantity=Decimal(quantity),
                cost=Decimal(cost),
                value=Decimal(value),
                returns=Decimal(returns),
            )
        )

    return positions
