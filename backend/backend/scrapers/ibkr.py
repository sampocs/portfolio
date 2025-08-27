from ibind import IbkrClient
from backend.config import config
from backend.database import models
from datetime import datetime
from decimal import Decimal


def get_current_holdings() -> list[models.Position]:
    """Retrieves current IBKR holdings"""
    client = IbkrClient(**config.ibind_client_params)
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
