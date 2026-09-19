import datetime
from decimal import Decimal

from backend import lots
from backend.config import config
from backend.database import crud, models
from backend.router import transforms
from tests import factories
from tests.conftest import _asset_config


def test_quantity_cost_and_average_price_sum_across_accounts():
    buy_brokerage = factories.make_trade(id="b-brok")
    buy_roth = factories.make_trade(
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


def test_asset_fully_sold_out_produces_zero_quantity_position():
    buy = factories.make_trade(id="b-1")
    sell = factories.make_trade(
        id="s-1",
        date=datetime.date(2026, 1, 2),
        action=models.TradeAction.SELL.value,
        price=Decimal("110"),
        cost=Decimal("1100"),
        value=Decimal("1100"),
    )

    matches = lots.match_lots([buy, sell])
    positions = crud.positions_from_matches(matches)

    assert len(positions) == 1
    position = positions[0]
    assert position.asset == "AAPL"
    assert position.quantity == Decimal("0")
    assert position.cost == Decimal("0")
    assert position.average_price == Decimal("0")


def test_asset_with_only_excluded_trades_produces_no_position():
    excluded_buy = factories.make_trade(id="b-1", excluded=True)

    matches = lots.match_lots([excluded_buy])
    positions = crud.positions_from_matches(matches)

    assert positions == []


def test_build_positions_from_trades_includes_zero_row_for_fully_sold_asset(
    db_session, monkeypatch
):
    monkeypatch.setattr(
        config, "assets", {"VT": _asset_config("VT"), "VOO": _asset_config("VOO")}
    )

    buy = factories.make_trade(id="b-1", asset="VT")
    sell = factories.make_trade(
        id="s-1",
        asset="VT",
        date=datetime.date(2026, 1, 2),
        action=models.TradeAction.SELL.value,
        price=Decimal("110"),
        cost=Decimal("1100"),
        value=Decimal("1100"),
    )
    open_buy = factories.make_trade(
        id="b-2",
        asset="VOO",
        quantity=Decimal("3"),
        cost=Decimal("300"),
        value=Decimal("300"),
    )
    crud.store_trades(db_session, [buy, sell, open_buy])

    positions = crud.build_positions_from_trades(db_session, end_date="2026-01-02")
    positions_by_asset = {position.asset: position for position in positions}

    assert set(positions_by_asset.keys()) == {"VT", "VOO"}
    assert positions_by_asset["VT"].quantity == Decimal("0")
    assert positions_by_asset["VT"].cost == Decimal("0")
    assert positions_by_asset["VT"].average_price == Decimal("0")
    assert positions_by_asset["VOO"].quantity == Decimal("3")


def test_build_positions_from_trades_no_row_for_asset_with_no_trades(
    db_session, monkeypatch
):
    monkeypatch.setattr(
        config, "assets", {"VT": _asset_config("VT"), "VOO": _asset_config("VOO")}
    )

    buy = factories.make_trade(id="b-1", asset="VT")
    crud.store_trades(db_session, [buy])

    positions = crud.build_positions_from_trades(db_session)

    assert [position.asset for position in positions] == ["VT"]


def test_build_historical_positions_skips_zero_quantity_positions(
    db_session, monkeypatch
):
    monkeypatch.setattr(config, "assets", {"VT": _asset_config("VT")})

    buy = factories.make_trade(id="b-1", asset="VT")
    sell = factories.make_trade(
        id="s-1",
        asset="VT",
        date=datetime.date(2026, 1, 2),
        action=models.TradeAction.SELL.value,
        price=Decimal("110"),
        cost=Decimal("1100"),
        value=Decimal("1100"),
    )
    crud.store_trades(db_session, [buy, sell])

    # No HistoricalPrice rows are seeded: if a zero-quantity position reached the
    # enricher it would divide by its zero cost and raise, so an empty result here
    # proves the position was filtered out before enrichment, not tolerated inside it.
    historical_positions = crud.build_historical_positions(db_session, ["2026-01-02"])

    assert historical_positions == []


def test_get_enriched_positions_computes_cash_flow_based_returns(
    db_session, monkeypatch
):
    monkeypatch.setattr(
        config, "assets", {"VT": _asset_config("VT"), "VOO": _asset_config("VOO")}
    )

    # VT: fully sold out - a zero-quantity position that should still report its
    # realized result and zero current_allocation
    db_session.add(
        models.Position(
            asset="VT",
            updated_at=datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc),
            average_price=Decimal("0"),
            quantity=Decimal("0"),
            cost=Decimal("0"),
        )
    )
    # VOO: still open
    db_session.add(
        models.Position(
            asset="VOO",
            updated_at=datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc),
            average_price=Decimal("100"),
            quantity=Decimal("5"),
            cost=Decimal("500"),
        )
    )
    db_session.add(models.LivePrice(asset="VT", price=Decimal("150")))
    db_session.add(models.LivePrice(asset="VOO", price=Decimal("120")))
    crud.store_trades(
        db_session,
        [
            factories.make_trade(id="vt-b-1", asset="VT", cost=Decimal("1000")),
            factories.make_trade(
                id="vt-s-1",
                asset="VT",
                date=datetime.date(2026, 1, 2),
                action=models.TradeAction.SELL.value,
                cost=Decimal("1100"),
            ),
            factories.make_trade(
                id="voo-b-1", asset="VOO", quantity=Decimal("5"), cost=Decimal("500")
            ),
        ],
    )
    db_session.commit()

    positions = {
        position.asset: position
        for position in transforms.get_enriched_positions(db_session)
    }

    vt = positions["VT"]
    assert vt.value == Decimal("0")
    assert vt.buys == Decimal("1000")
    assert vt.sells == Decimal("1100")
    assert vt.total_return == Decimal("100")  # 0 + 1100 - 1000
    assert vt.returns == Decimal("10")  # 100 / 1000 * 100
    assert vt.current_allocation == Decimal("0")

    voo = positions["VOO"]
    assert voo.value == Decimal("600")  # 5 * 120
    assert voo.buys == Decimal("500")
    assert voo.sells == Decimal("0")
    assert voo.total_return == Decimal("100")  # 600 + 0 - 500
    assert voo.returns == Decimal("20")  # 100 / 500 * 100
    assert voo.current_allocation == Decimal("100")  # only non-zero value


def test_get_enriched_positions_current_allocation_zero_when_total_value_is_zero(
    db_session, monkeypatch
):
    monkeypatch.setattr(config, "assets", {"VT": _asset_config("VT")})

    # VT: fully sold out - the only position, so total_value across all positions is
    # zero and current_allocation must not divide by it
    db_session.add(
        models.Position(
            asset="VT",
            updated_at=datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc),
            average_price=Decimal("0"),
            quantity=Decimal("0"),
            cost=Decimal("0"),
        )
    )
    db_session.add(models.LivePrice(asset="VT", price=Decimal("150")))
    crud.store_trades(
        db_session,
        [
            factories.make_trade(id="vt-b-1", asset="VT", cost=Decimal("1000")),
            factories.make_trade(
                id="vt-s-1",
                asset="VT",
                date=datetime.date(2026, 1, 2),
                action=models.TradeAction.SELL.value,
                cost=Decimal("1100"),
            ),
        ],
    )
    db_session.commit()

    positions = transforms.get_enriched_positions(db_session)

    assert len(positions) == 1
    assert positions[0].current_allocation == Decimal("0")
