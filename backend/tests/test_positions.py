from decimal import Decimal

from backend import lots
from backend.database import crud, models


def test_quantity_cost_and_average_price_sum_across_accounts():
    buy_brokerage = models.Trade(
        id="b-brok",
        platform="ibkr",
        date="2026-01-01",
        action=models.TradeAction.BUY.value,
        asset="AAPL",
        price=Decimal("100"),
        quantity=Decimal("10"),
        fees=Decimal("0"),
        cost=Decimal("1000"),
        value=Decimal("1000"),
        excluded=False,
        account=models.TradeAccount.BROKERAGE.value,
    )
    buy_roth = models.Trade(
        id="b-roth",
        platform="ibkr",
        date="2026-01-01",
        action=models.TradeAction.BUY.value,
        asset="AAPL",
        price=Decimal("200"),
        quantity=Decimal("5"),
        fees=Decimal("0"),
        cost=Decimal("1000"),
        value=Decimal("1000"),
        excluded=False,
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
    buy = models.Trade(
        id="b-1",
        platform="ibkr",
        date="2026-01-01",
        action=models.TradeAction.BUY.value,
        asset="AAPL",
        price=Decimal("100"),
        quantity=Decimal("10"),
        fees=Decimal("0"),
        cost=Decimal("1000"),
        value=Decimal("1000"),
        excluded=False,
        account=models.TradeAccount.BROKERAGE.value,
    )
    sell = models.Trade(
        id="s-1",
        platform="ibkr",
        date="2026-01-02",
        action=models.TradeAction.SELL.value,
        asset="AAPL",
        price=Decimal("110"),
        quantity=Decimal("10"),
        fees=Decimal("0"),
        cost=Decimal("1100"),
        value=Decimal("1100"),
        excluded=False,
        account=models.TradeAccount.BROKERAGE.value,
    )

    matches = lots.match_lots([buy, sell])
    positions = crud.positions_from_matches(matches)

    assert positions == []
