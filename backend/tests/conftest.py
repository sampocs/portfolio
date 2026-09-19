from collections.abc import Generator
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from backend.config import Asset, Market, Platform, PriceType, Segment
from backend.database import models


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
