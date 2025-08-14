from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from backend.config import config

engine = create_engine(config.postgres_url, pool_size=15, max_overflow=10, pool_timeout=60)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Get DB session using context manager for automatic cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
