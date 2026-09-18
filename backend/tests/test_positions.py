import datetime
from decimal import Decimal

from backend import lots
from backend.database import crud, models


def _trade(**overrides) -> models.Trade:
    defaults = {
        "id": "t-1",
        "platform": "ibkr",
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


def test_quantity_cost_and_average_price_sum_across_accounts():
    buy_brokerage = _trade(id="b-brok")
    buy_roth = _trade(
        id="b-roth",
        price=Decimal("200"),
        quantity=Decimal("5"),
        account=models.TradeAccount.ROTH.value,
    )

    matches = lots.match_lots([buy_brokerage, buy_roth])
    positions = crud.positions_from_matches(matches)

    assert len(positions) == 1
    position = positions[0]
    assert position.asset == "AAPL"
    # quantity and cost sum across both accounts' open lots
    assert position.quantity == Decimal("15")
    assert position.cost == Decimal("10") * Decimal("100") + Decimal("5") * Decimal(
        "200"
    )
    assert position.average_price == position.cost / position.quantity


def test_asset_fully_sold_out_produces_no_position():
    buy = _trade(id="b-1")
    sell = _trade(
        id="s-1",
        date=datetime.date(2026, 1, 2),
        action=models.TradeAction.SELL.value,
        price=Decimal("110"),
        cost=Decimal("1100"),
        value=Decimal("1100"),
    )

    matches = lots.match_lots([buy, sell])
    positions = crud.positions_from_matches(matches)

    assert positions == []
