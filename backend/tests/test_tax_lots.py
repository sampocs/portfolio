import datetime
from decimal import Decimal

from backend import lots
from backend.database import crud, models


def _trade(**overrides) -> models.Trade:
    defaults = {
        "id": "t-1",
        "platform": "ibkr",
        "custodian": "ibkr",
        "date": datetime.date(2026, 1, 1),
        "action": models.TradeAction.BUY.value,
        "asset": "AAPL",
        "price": Decimal("100"),
        "quantity": Decimal("10"),
        "fees": Decimal("5"),
        "cost": Decimal("1005"),
        "value": Decimal("1000"),
        "excluded": False,
        "account": models.TradeAccount.BROKERAGE.value,
    }
    return models.Trade(**{**defaults, **overrides})


def test_holding_period_is_short_term_at_exactly_one_year():
    buy = _trade(id="b-1", date=datetime.date(2025, 1, 1))
    sell = _trade(
        id="s-1",
        date=datetime.date(2026, 1, 1),
        action=models.TradeAction.SELL.value,
        quantity=Decimal("10"),
    )

    matches = lots.match_lots([buy, sell])
    tax_lots = crud.build_tax_lots(matches)

    assert len(tax_lots) == 1
    assert tax_lots[0].holding_period == models.HoldingPeriod.SHORT_TERM.value


def test_long_term_holding_period_survives_a_transfer_between_custodians():
    # Bought at Vanguard over a year ago, then transferred to Robinhood before being
    # sold there. The original acquisition date must survive the move so the holding
    # period is still computed from it, not from the transfer date.
    transferred_buy = _trade(
        id="b-van",
        platform="vanguard",
        custodian="robinhood",
        date=datetime.date(2025, 1, 1),
    )
    robinhood_sell = _trade(
        id="s-rh",
        platform="robinhood",
        custodian="robinhood",
        date=datetime.date(2026, 1, 2),
        action=models.TradeAction.SELL.value,
        quantity=Decimal("10"),
    )

    matches = lots.match_lots([transferred_buy, robinhood_sell])
    tax_lots = crud.build_tax_lots(matches)

    assert len(tax_lots) == 1
    tax_lot = tax_lots[0]
    assert tax_lot.holding_period == models.HoldingPeriod.LONG_TERM.value
    assert tax_lot.date_acquired == transferred_buy.date
    # A sell always executes where the shares are held, so platform == custodian here
    assert tax_lot.platform == robinhood_sell.platform == robinhood_sell.custodian


def test_holding_period_is_long_term_one_day_after_one_year():
    buy = _trade(id="b-1", date=datetime.date(2025, 1, 1))
    sell = _trade(
        id="s-1",
        date=datetime.date(2026, 1, 2),
        action=models.TradeAction.SELL.value,
        quantity=Decimal("10"),
    )

    matches = lots.match_lots([buy, sell])
    tax_lots = crud.build_tax_lots(matches)

    assert len(tax_lots) == 1
    assert tax_lots[0].holding_period == models.HoldingPeriod.LONG_TERM.value


def test_partial_buy_lot_carries_prorated_share_of_buy_fees():
    # Sell takes half of the 10-share buy lot, so the slice should carry half the
    # buy's fees and value, and all of the sell's fees since it sells the full amount
    buy = _trade(
        id="b-1",
        date=datetime.date(2025, 1, 1),
        quantity=Decimal("10"),
        price=Decimal("100"),
        value=Decimal("1000"),
        fees=Decimal("10"),
    )
    sell = _trade(
        id="s-1",
        date=datetime.date(2025, 6, 1),
        action=models.TradeAction.SELL.value,
        quantity=Decimal("5"),
        price=Decimal("120"),
        value=Decimal("600"),
        fees=Decimal("6"),
    )

    matches = lots.match_lots([buy, sell])
    tax_lots = crud.build_tax_lots(matches)

    assert len(tax_lots) == 1
    tax_lot = tax_lots[0]
    assert tax_lot.quantity == Decimal("5")
    # cost = (buy.value + buy.fees) * quantity / buy.quantity = (1000 + 10) * 5 / 10
    assert tax_lot.cost == Decimal("505")
    # proceeds = (sell.value - sell.fees) * quantity / sell.quantity = (600 - 6) * 5 / 5
    assert tax_lot.proceeds == Decimal("594")


def test_proceeds_and_cost_prorate_across_multiple_slices_of_one_sell():
    # A sell spanning two buy lots should prorate the sell's fees by each slice's
    # share of the sell's total quantity, while each buy's own fees prorate by that
    # buy's own consumed share (here, each buy lot is fully consumed)
    buy_1 = _trade(
        id="b-1",
        date=datetime.date(2025, 1, 1),
        quantity=Decimal("4"),
        price=Decimal("100"),
        value=Decimal("400"),
        fees=Decimal("4"),
    )
    buy_2 = _trade(
        id="b-2",
        date=datetime.date(2025, 1, 2),
        quantity=Decimal("6"),
        price=Decimal("110"),
        value=Decimal("660"),
        fees=Decimal("6"),
    )
    sell = _trade(
        id="s-1",
        date=datetime.date(2025, 6, 1),
        action=models.TradeAction.SELL.value,
        quantity=Decimal("10"),
        price=Decimal("150"),
        value=Decimal("1500"),
        fees=Decimal("15"),
    )

    matches = lots.match_lots([buy_1, buy_2, sell])
    tax_lots = crud.build_tax_lots(matches)

    assert len(tax_lots) == 2
    first, second = tax_lots
    # cost = (buy.value + buy.fees) * quantity / buy.quantity, fully consumed lots
    assert first.cost == Decimal("404")
    assert second.cost == Decimal("666")
    # proceeds = (sell.value - sell.fees) * quantity / sell.quantity, prorated by
    # each slice's share of the sell (4/10 and 6/10)
    assert first.proceeds == Decimal("594.0")
    assert second.proceeds == Decimal("891.0")


def test_roth_sells_produce_no_tax_lot_rows():
    roth_buy = _trade(
        id="b-roth",
        asset="ROTH_ASSET",
        date=datetime.date(2025, 1, 1),
        account=models.TradeAccount.ROTH.value,
    )
    roth_sell = _trade(
        id="s-roth",
        asset="ROTH_ASSET",
        date=datetime.date(2025, 6, 1),
        action=models.TradeAction.SELL.value,
        quantity=Decimal("10"),
        account=models.TradeAccount.ROTH.value,
    )
    brokerage_buy = _trade(
        id="b-brok",
        asset="BROKERAGE_ASSET",
        date=datetime.date(2025, 1, 1),
        account=models.TradeAccount.BROKERAGE.value,
    )
    brokerage_sell = _trade(
        id="s-brok",
        asset="BROKERAGE_ASSET",
        date=datetime.date(2025, 6, 1),
        action=models.TradeAction.SELL.value,
        quantity=Decimal("10"),
        account=models.TradeAccount.BROKERAGE.value,
    )

    matches = lots.match_lots([roth_buy, roth_sell, brokerage_buy, brokerage_sell])
    tax_lots = crud.build_tax_lots(matches)

    assert len(tax_lots) == 1
    assert tax_lots[0].id.startswith("s-brok-")


def test_ids_count_slices_within_a_sell_from_zero():
    buy_1 = _trade(id="b-1", date=datetime.date(2025, 1, 1), quantity=Decimal("4"))
    buy_2 = _trade(id="b-2", date=datetime.date(2025, 1, 2), quantity=Decimal("6"))
    sell = _trade(
        id="s-1",
        date=datetime.date(2025, 6, 1),
        action=models.TradeAction.SELL.value,
        quantity=Decimal("10"),
    )

    matches = lots.match_lots([buy_1, buy_2, sell])
    tax_lots = crud.build_tax_lots(matches)

    assert [tax_lot.id for tax_lot in tax_lots] == ["s-1-0", "s-1-1"]


def test_ids_reset_to_zero_for_each_separate_sell():
    buy_1 = _trade(id="b-1", date=datetime.date(2025, 1, 1), quantity=Decimal("10"))
    sell_1 = _trade(
        id="s-1",
        date=datetime.date(2025, 6, 1),
        action=models.TradeAction.SELL.value,
        quantity=Decimal("10"),
    )
    buy_2 = _trade(id="b-2", date=datetime.date(2025, 7, 1), quantity=Decimal("10"))
    sell_2 = _trade(
        id="s-2",
        date=datetime.date(2025, 8, 1),
        action=models.TradeAction.SELL.value,
        quantity=Decimal("10"),
    )

    matches = lots.match_lots([buy_1, sell_1, buy_2, sell_2])
    tax_lots = crud.build_tax_lots(matches)

    assert [tax_lot.id for tax_lot in tax_lots] == ["s-1-0", "s-2-0"]


def test_tax_lot_row_carries_every_column_including_formatted_description():
    buy = _trade(
        id="b-1",
        platform="vanguard",
        asset="VOO",
        date=datetime.date(2025, 1, 1),
        quantity=Decimal("10.000000"),
        price=Decimal("100"),
        value=Decimal("1000"),
        fees=Decimal("10"),
    )
    sell = _trade(
        id="s-1",
        platform="vanguard",
        asset="VOO",
        date=datetime.date(2025, 6, 1),
        action=models.TradeAction.SELL.value,
        quantity=Decimal("0.500000"),
        price=Decimal("120"),
        value=Decimal("60"),
        fees=Decimal("6"),
    )

    matches = lots.match_lots([buy, sell])
    tax_lots = crud.build_tax_lots(matches)

    assert len(tax_lots) == 1
    tax_lot = tax_lots[0]
    assert tax_lot.description == "0.5 VOO"
    assert tax_lot.date_acquired == buy.date
    assert tax_lot.date_sold == sell.date
    assert tax_lot.acquisition_price == buy.price
    assert tax_lot.sale_price == sell.price
    assert tax_lot.platform == "vanguard"
    assert tax_lot.asset == "VOO"
    assert tax_lot.account == models.TradeAccount.BROKERAGE.value
