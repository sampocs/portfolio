from collections.abc import Generator

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

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
