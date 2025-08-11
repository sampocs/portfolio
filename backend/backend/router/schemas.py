from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class Position(BaseModel):
    """Defines the schema for the /positions API response"""

    asset: str
    category: str
    description: str
    current_price: Decimal
    average_price: Decimal
    quantity: Decimal
    cost: Decimal
    value: Decimal
    returns: Decimal
    current_allocation: Decimal
    target_allocation: Decimal

    model_config = ConfigDict(from_attributes=True)


class Performance(BaseModel):
    """
    Defines the schema for the /performance API response which returns
    the cost/value/return at each point in time
    """

    date: str
    cost: Decimal
    value: Decimal
    returns: Decimal
