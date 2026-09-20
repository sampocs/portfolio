import datetime
from decimal import Decimal

import fastapi
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.config import config
from backend.database import connection, crud, models
from backend.router import routes, transforms
from tests import factories
from tests.conftest import _asset_config


@pytest.fixture
def client() -> TestClient:
    """
    Serves the router against its own in-memory db. TestClient dispatches requests
    from a worker thread, so - unlike `db_session`, which relies on a single
    thread-local connection - the engine needs a `StaticPool` connection shared
    across threads, or the route would see an empty, table-less database.
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    models.Base.metadata.create_all(engine)
    session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    app = fastapi.FastAPI()
    app.include_router(routes.router)
    # A plain lambda, not `session_local` itself - FastAPI introspects the dependency
    # callable's signature, and sessionmaker.__call__ takes **kwargs that read as
    # spurious query parameters
    app.dependency_overrides[connection.get_db] = lambda: session_local()
    return TestClient(app)


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {config.fastapi_secret}"}


# --- transforms.get_asset_performance ------------------------------------------------


def test_start_value_and_start_buys_zero_for_asset_first_bought_inside_window(
    db_session, monkeypatch
):
    monkeypatch.setattr(config, "assets", {"VT": _asset_config("VT")})
    today = datetime.date.today()
    bought_date = today - datetime.timedelta(days=10)  # inside the 1M window

    crud.store_trades(
        db_session,
        [
            factories.make_trade(
                id="b-1", asset="VT", date=bought_date, cost=Decimal("500")
            )
        ],
    )

    performance = transforms.get_asset_performance(
        db_session, asset="VT", duration="1M"
    )

    assert performance.start_value == Decimal("0")
    assert performance.start_buys == Decimal("0")
    assert performance.start_sells == Decimal("0")


def test_start_value_matches_row_and_start_buys_includes_trades_on_start_date(
    db_session, monkeypatch
):
    monkeypatch.setattr(config, "assets", {"VT": _asset_config("VT")})
    today = datetime.date.today()
    start_date = today - datetime.timedelta(days=30)  # 1M window start, no buffer

    db_session.add(
        factories.make_historical_position(
            asset="VT", date=start_date, value=Decimal("777.77")
        )
    )
    crud.store_trades(
        db_session,
        [
            factories.make_trade(
                id="b-1", asset="VT", date=start_date, cost=Decimal("300")
            )
        ],
    )
    db_session.commit()

    performance = transforms.get_asset_performance(
        db_session, asset="VT", duration="1M"
    )

    assert performance.start_date == str(start_date)
    assert performance.start_value == Decimal("777.77")
    assert performance.start_buys == Decimal("300")  # trade made ON the start date


def test_fully_sold_asset_history_ends_on_its_last_held_day(db_session, monkeypatch):
    monkeypatch.setattr(config, "assets", {"VT": _asset_config("VT")})
    today = datetime.date.today()
    day1 = today - datetime.timedelta(days=5)
    day2 = today - datetime.timedelta(days=4)
    last_held_day = today - datetime.timedelta(days=3)  # asset sold to zero after this

    db_session.add_all(
        [
            factories.make_historical_position(
                asset="VT", date=day1, value=Decimal("500")
            ),
            factories.make_historical_position(
                asset="VT", date=day2, value=Decimal("550")
            ),
            factories.make_historical_position(
                asset="VT", date=last_held_day, value=Decimal("600")
            ),
            # No row after last_held_day - build_historical_positions skips
            # zero-quantity positions, so a fully sold asset simply stops here
        ]
    )
    crud.store_trades(
        db_session,
        [
            factories.make_trade(id="b-1", asset="VT", date=day1, cost=Decimal("1000")),
            factories.make_trade(
                id="s-1",
                asset="VT",
                date=last_held_day,
                action=models.TradeAction.SELL.value,
                cost=Decimal("1200"),
            ),
        ],
    )
    db_session.commit()

    performance = transforms.get_asset_performance(
        db_session, asset="VT", duration="1M"
    )

    assert [point.date for point in performance.history] == [
        str(day1),
        str(day2),
        str(last_held_day),
    ]
    assert performance.history[-1].value == Decimal("600")
    assert performance.history[-1].sells == Decimal("1200")


# --- route validation: 1D accepted for the asset route, rejected by /performance -----


def test_1d_accepted_by_asset_performance_route_but_rejected_by_performance_route(
    client, monkeypatch
):
    monkeypatch.setattr(config, "assets", {"VT": _asset_config("VT")})

    asset_response = client.get("/positions/VT/performance/1D", headers=_auth_headers())
    assert asset_response.status_code == 200
    assert "history" in asset_response.json()

    # /performance/{duration} keeps rejecting "1D" - VALID_DURATIONS is unchanged
    portfolio_response = client.get("/performance/1D", headers=_auth_headers())
    assert "Invalid duration" in portfolio_response.json()["detail"]


def test_asset_performance_route_rejects_unconfigured_asset(client, monkeypatch):
    monkeypatch.setattr(config, "assets", {"VT": _asset_config("VT")})

    response = client.get("/positions/ZZZ/performance/1M", headers=_auth_headers())

    assert response.status_code == 400
    assert "Invalid asset" in response.json()["detail"]


def test_asset_performance_route_rejects_invalid_duration(client, monkeypatch):
    monkeypatch.setattr(config, "assets", {"VT": _asset_config("VT")})

    response = client.get("/positions/VT/performance/ALL", headers=_auth_headers())

    assert response.status_code == 400
    assert "Invalid duration" in response.json()["detail"]
