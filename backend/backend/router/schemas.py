import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class Position(BaseModel):
    """
    Defines the schema for the /positions API response. `cost` and `average_price` are
    the remaining FIFO cost basis of open lots (0 for a fully sold, zero-quantity
    position). `buys`/`sells` are total cash paid/received across all non-excluded
    trades; `total_return` is `value + sells - buys` and `returns` is
    `total_return / buys * 100` (0 when `buys` is 0) - cash-out over cash-in, so a
    fully sold position still reports its realized result.
    """

    asset: str
    market: str
    segment: str
    description: str
    current_price: Decimal
    average_price: Decimal
    quantity: Decimal
    cost: Decimal
    value: Decimal
    buys: Decimal
    sells: Decimal
    total_return: Decimal
    returns: Decimal
    current_allocation: Decimal
    target_allocation: Decimal

    model_config = ConfigDict(from_attributes=True)


class Performance(BaseModel):
    """
    Defines the schema for the /performance API response which returns the
    cost/value/buys/sells/return at each point in time. `cost` is the remaining FIFO
    cost basis of open lots; `buys`/`sells` are cumulative cash paid/received through
    that date. `returns` is `(value + sells - buys) / buys * 100` (0 when `buys` is 0).
    """

    date: str
    cost: Decimal
    value: Decimal
    buys: Decimal
    sells: Decimal
    returns: Decimal


class HistoricalPrice(BaseModel):
    """
    Defines the schema for individual historical price entries.
    """

    date: str
    price: Decimal


class AssetPriceHistory(BaseModel):
    """
    Defines the schema for the /prices API response which returns
    the live and historical prices
    """

    live_price: Decimal
    updated_at: datetime.datetime
    historical_prices: list[HistoricalPrice]
