import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class Position(BaseModel):
    """Defines the schema for the /positions API response"""

    asset: str
    updated_at: datetime.date
    current_price: Decimal
    average_price: Decimal
    quantity: Decimal
    cost: Decimal
    value: Decimal
    returns: Decimal

    model_config = ConfigDict(from_attributes=True)
