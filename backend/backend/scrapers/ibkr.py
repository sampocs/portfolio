from ibind import IbkrClient
from backend.config import config
from backend.database import models
from datetime import datetime
from decimal import Decimal

_client: IbkrClient = None  # type: ignore


def _get_client() -> IbkrClient:
    """Retreives an IBKR singleton client"""
    global _client
    if _client is None:
        _client = IbkrClient(**config.ibind_client_params)
    return _client


def get_current_holdings() -> list[models.Position]:
    """Retrieves current IBKR holdings"""
    client = _get_client()
    positions_data = client.positions2(config.ibkr_account_id)
    assert positions_data.data, "No positions found for account"

    positions = []
    for position in positions_data.data:
        asset = position["description"]
        price = position["marketPrice"]
        quantity = position["position"]
        value = position["marketValue"]

        average_price = position["avgPrice"]
        cost = average_price * quantity

        returns = (value - cost) / cost * 100

        positions.append(
            models.Position(
                asset=asset,
                updated_at=datetime.now(),
                current_price=Decimal(price),
                average_price=Decimal(average_price),
                quantity=Decimal(quantity),
                cost=Decimal(cost),
                value=Decimal(value),
                returns=Decimal(returns),
            )
        )

    return positions
