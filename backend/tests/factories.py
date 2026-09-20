import datetime
from decimal import Decimal

from backend.database import models


def make_trade(**overrides) -> models.Trade:
    defaults = {
        "id": "t-1",
        "platform": "ibkr",
        "custodian": "ibkr",
        "date": datetime.date(2026, 1, 1),
        "action": models.TradeAction.BUY.value,
        "asset": "AAPL",
        "price": Decimal("100"),
        "quantity": Decimal("10"),
        "fees": Decimal("0"),
        "cost": Decimal("1000"),
        "value": Decimal("1000"),
        "excluded": False,
        "account": models.TradeAccount.BROKERAGE.value,
    }
    return models.Trade(**{**defaults, **overrides})


def make_historical_position(**overrides) -> models.HistoricalPosition:
    defaults = {
        "asset": "VT",
        "date": datetime.date(2026, 1, 1),
        "average_position_price": Decimal("100"),
        "daily_close_price": Decimal("100"),
        "quantity": Decimal("10"),
        "cost": Decimal("1000"),
        "value": Decimal("1000"),
        "returns": Decimal("0"),
    }
    return models.HistoricalPosition(**{**defaults, **overrides})


def make_historical_price(**overrides) -> models.HistoricalPrice:
    defaults = {
        "asset": "VT",
        "date": datetime.date(2026, 1, 1),
        "price": Decimal("100"),
    }
    return models.HistoricalPrice(**{**defaults, **overrides})
