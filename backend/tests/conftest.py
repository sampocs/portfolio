from collections.abc import Generator
from decimal import Decimal

import fastapi
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.config import Asset, Market, Platform, PriceType, Segment
from backend.database import connection, models
from backend.router import routes


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """In-memory SQLite session, built fresh from models.Base for each test"""
    engine = create_engine("sqlite:///:memory:")
    models.Base.metadata.create_all(engine)
    session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    session = session_local()
    try:
        yield session
    finally:
        session.close()


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


def _asset_config(asset: str) -> Asset:
    """Builds a minimal Asset config for tests that monkeypatch `config.assets`"""
    return Asset(
        asset=asset,
        description=asset,
        target_allocation=Decimal("10"),
        market=Market.STOCKS,
        segment=Segment.STOCK_ETFS,
        platform=Platform.IBKR,
        price_type=PriceType.STOCKS,
        contract_id="1",
    )
