import datetime
from decimal import Decimal

from backend.config import config
from backend.database import crud, models
from backend.router import transforms
from tests import factories
from tests.conftest import _asset_config


def _historical_position(**overrides) -> models.HistoricalPosition:
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


# --- crud.get_cash_flows -----------------------------------------------------------


def test_get_cash_flows_sums_buys_and_sells_by_asset_and_ignores_excluded(
    db_session, monkeypatch
):
    monkeypatch.setattr(
        config, "assets", {"VT": _asset_config("VT"), "VOO": _asset_config("VOO")}
    )
    buy = factories.make_trade(id="b-1", asset="VT", cost=Decimal("1000"))
    sell = factories.make_trade(
        id="s-1",
        asset="VT",
        date=datetime.date(2026, 1, 2),
        action=models.TradeAction.SELL.value,
        cost=Decimal("600"),
    )
    excluded = factories.make_trade(
        id="b-2",
        asset="VT",
        date=datetime.date(2026, 1, 3),
        cost=Decimal("999"),
        excluded=True,
    )
    other_asset = factories.make_trade(
        id="b-3", asset="VOO", date=datetime.date(2026, 1, 1), cost=Decimal("300")
    )
    crud.store_trades(db_session, [buy, sell, excluded, other_asset])

    cash_flows = crud.get_cash_flows(db_session)

    assert cash_flows["VT"] == crud.CashFlow(buys=Decimal("1000"), sells=Decimal("600"))
    assert cash_flows["VOO"] == crud.CashFlow(buys=Decimal("300"), sells=Decimal("0"))


def test_get_cash_flows_honors_asset_filter(db_session):
    vt_buy = factories.make_trade(id="b-1", asset="VT", cost=Decimal("1000"))
    voo_buy = factories.make_trade(
        id="b-2", asset="VOO", date=datetime.date(2026, 1, 1), cost=Decimal("300")
    )
    crud.store_trades(db_session, [vt_buy, voo_buy])

    cash_flows = crud.get_cash_flows(db_session, assets=["VT"])

    assert set(cash_flows.keys()) == {"VT"}


# --- crud.get_daily_cash_flows -------------------------------------------------------


def test_get_daily_cash_flows_groups_by_date_ascending_and_ignores_excluded(
    db_session, monkeypatch
):
    monkeypatch.setattr(
        config, "assets", {"VT": _asset_config("VT"), "VOO": _asset_config("VOO")}
    )
    day2_buy = factories.make_trade(
        id="b-1", asset="VT", date=datetime.date(2026, 1, 2), cost=Decimal("1000")
    )
    day2_sell = factories.make_trade(
        id="s-1",
        asset="VOO",
        date=datetime.date(2026, 1, 2),
        action=models.TradeAction.SELL.value,
        cost=Decimal("200"),
    )
    day1_buy = factories.make_trade(
        id="b-2", asset="VT", date=datetime.date(2026, 1, 1), cost=Decimal("500")
    )
    excluded = factories.make_trade(
        id="b-3",
        asset="VT",
        date=datetime.date(2026, 1, 1),
        cost=Decimal("999"),
        excluded=True,
    )
    crud.store_trades(db_session, [day2_buy, day2_sell, day1_buy, excluded])

    daily_flows = crud.get_daily_cash_flows(db_session)

    assert [flow.date for flow in daily_flows] == [
        datetime.date(2026, 1, 1),
        datetime.date(2026, 1, 2),
    ]
    assert daily_flows[0] == crud.DailyCashFlow(
        date=datetime.date(2026, 1, 1), buys=Decimal("500"), sells=Decimal("0")
    )
    # not cumulative - day 2's entry excludes day 1's buy
    assert daily_flows[1] == crud.DailyCashFlow(
        date=datetime.date(2026, 1, 2), buys=Decimal("1000"), sells=Decimal("200")
    )


def test_get_daily_cash_flows_honors_asset_filter(db_session):
    vt = factories.make_trade(
        id="b-1", asset="VT", date=datetime.date(2026, 1, 1), cost=Decimal("1000")
    )
    voo = factories.make_trade(
        id="b-2", asset="VOO", date=datetime.date(2026, 1, 1), cost=Decimal("300")
    )
    crud.store_trades(db_session, [vt, voo])

    daily_flows = crud.get_daily_cash_flows(db_session, assets=["VT"])

    assert daily_flows == [
        crud.DailyCashFlow(
            date=datetime.date(2026, 1, 1), buys=Decimal("1000"), sells=Decimal("0")
        )
    ]


def test_get_cash_flows_and_daily_cash_flows_ignore_unconfigured_assets_by_default(
    db_session, monkeypatch
):
    monkeypatch.setattr(config, "assets", {"VT": _asset_config("VT")})

    vt = factories.make_trade(
        id="b-1", asset="VT", date=datetime.date(2026, 1, 1), cost=Decimal("1000")
    )
    unconfigured = factories.make_trade(
        id="b-2", asset="ZZZ", date=datetime.date(2026, 1, 1), cost=Decimal("300")
    )
    crud.store_trades(db_session, [vt, unconfigured])

    cash_flows = crud.get_cash_flows(db_session)
    daily_flows = crud.get_daily_cash_flows(db_session)

    assert cash_flows == {"VT": crud.CashFlow(buys=Decimal("1000"), sells=Decimal("0"))}
    assert daily_flows == [
        crud.DailyCashFlow(
            date=datetime.date(2026, 1, 1), buys=Decimal("1000"), sells=Decimal("0")
        )
    ]


# --- transforms._accumulate_running_cash_flows (pure, list-driven) ------------------


def test_accumulate_running_cash_flows_includes_trade_before_first_date():
    dates = [datetime.date(2026, 1, 5), datetime.date(2026, 1, 10)]
    daily_flows = [
        crud.DailyCashFlow(
            date=datetime.date(2026, 1, 1), buys=Decimal("100"), sells=Decimal("0")
        )
    ]

    running = transforms._accumulate_running_cash_flows(
        dates=dates, daily_cash_flows=daily_flows
    )

    assert running == [
        crud.CashFlow(buys=Decimal("100"), sells=Decimal("0")),
        crud.CashFlow(buys=Decimal("100"), sells=Decimal("0")),
    ]


def test_accumulate_running_cash_flows_includes_trade_made_on_the_history_date():
    dates = [datetime.date(2026, 1, 5), datetime.date(2026, 1, 10)]
    daily_flows = [
        crud.DailyCashFlow(
            date=datetime.date(2026, 1, 5), buys=Decimal("100"), sells=Decimal("0")
        ),
        crud.DailyCashFlow(
            date=datetime.date(2026, 1, 10), buys=Decimal("50"), sells=Decimal("20")
        ),
    ]

    running = transforms._accumulate_running_cash_flows(
        dates=dates, daily_cash_flows=daily_flows
    )

    assert running[0] == crud.CashFlow(buys=Decimal("100"), sells=Decimal("0"))
    assert running[1] == crud.CashFlow(buys=Decimal("150"), sells=Decimal("20"))


def test_accumulate_running_cash_flows_is_zero_before_any_trade():
    dates = [datetime.date(2026, 1, 1)]
    daily_flows = [
        crud.DailyCashFlow(
            date=datetime.date(2026, 1, 5), buys=Decimal("100"), sells=Decimal("0")
        )
    ]

    running = transforms._accumulate_running_cash_flows(
        dates=dates, daily_cash_flows=daily_flows
    )

    assert running == [crud.CashFlow(buys=Decimal("0"), sells=Decimal("0"))]


# --- transforms.get_performance (db-backed) -----------------------------------------


def test_get_performance_running_totals_include_trades_before_the_duration_window(
    db_session,
):
    """
    Regresses two things at once: (1) running buys/sells accumulate trades made
    before the duration window (the old trade), and (2) `returns` is cash-out over
    cash-in (`(value + sells - buys) / buys * 100`) rather than the unrealized
    `(value - cost) / cost * 100`. Cost is deliberately kept different from buys (and
    sells nonzero from the sell date on) at every point so the two formulas diverge -
    a regression using `cost` in place of `buys`, or dropping `sells`, changes the
    expected `returns` value.
    """
    today = datetime.date.today()
    old_trade_date = today - datetime.timedelta(days=100)  # outside the 1M window
    recent_trade_date = today - datetime.timedelta(days=10)
    sell_date = today - datetime.timedelta(days=4)

    crud.store_trades(
        db_session,
        [
            factories.make_trade(
                id="b-old", asset="VT", date=old_trade_date, cost=Decimal("1000")
            ),
            factories.make_trade(
                id="b-recent", asset="VT", date=recent_trade_date, cost=Decimal("500")
            ),
            factories.make_trade(
                id="s-1",
                asset="VT",
                date=sell_date,
                action=models.TradeAction.SELL.value,
                quantity=Decimal("5"),
                cost=Decimal("600"),
                value=Decimal("600"),
            ),
            # different asset - excluded by the asset filter below
            factories.make_trade(
                id="b-other", asset="VOO", date=old_trade_date, cost=Decimal("5000")
            ),
        ],
    )
    db_session.add_all(
        [
            _historical_position(
                asset="VT",
                date=recent_trade_date,
                cost=Decimal("1500"),
                value=Decimal("1800"),
            ),
            _historical_position(
                asset="VT", date=sell_date, cost=Decimal("900"), value=Decimal("1200")
            ),
            _historical_position(
                asset="VT", date=today, cost=Decimal("900"), value=Decimal("1300")
            ),
        ]
    )
    db_session.commit()

    performance = transforms.get_performance(db_session, duration="1M", assets=["VT"])

    assert [snapshot.date for snapshot in performance] == [
        str(recent_trade_date),
        str(sell_date),
        str(today),
    ]

    def _expected_returns(*, value: Decimal, sells: Decimal, buys: Decimal) -> Decimal:
        return (value + sells - buys) / buys * 100

    # before the sell date: no sells yet, and cost happens to equal buys here, so this
    # point alone would not catch a regression - the points below do.
    first = performance[0]
    assert first.buys == Decimal("1500")  # old trade (before the window) + recent trade
    assert first.sells == Decimal("0")
    assert first.cost == Decimal("1500")
    assert first.value == Decimal("1800")
    assert first.returns == _expected_returns(
        value=first.value, sells=first.sells, buys=first.buys
    )

    # on the sell date: sells becomes 600, and cost (900) diverges from buys (1500)
    second = performance[1]
    assert second.buys == Decimal("1500")  # no new buys since
    assert second.sells == Decimal("600")
    assert second.cost == Decimal("900")
    assert second.value == Decimal("1200")
    assert second.returns == _expected_returns(
        value=second.value, sells=second.sells, buys=second.buys
    )

    # after the sell date: sells stays at 600, cost still diverges from buys
    third = performance[2]
    assert third.buys == Decimal("1500")
    assert third.sells == Decimal("600")
    assert third.cost == Decimal("900")
    assert third.value == Decimal("1300")
    assert third.returns == _expected_returns(
        value=third.value, sells=third.sells, buys=third.buys
    )


def test_get_performance_returns_zero_when_buys_is_zero(db_session):
    db_session.add(
        _historical_position(
            asset="ORPHAN",
            date=datetime.date(2026, 1, 1),
            cost=Decimal("0"),
            value=Decimal("0"),
        )
    )
    db_session.commit()

    performance = transforms.get_performance(
        db_session, duration="ALL", assets=["ORPHAN"]
    )

    assert len(performance) == 1
    assert performance[0].buys == Decimal("0")
    assert performance[0].sells == Decimal("0")
    assert performance[0].returns == Decimal("0")
