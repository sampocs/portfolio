from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.config import config

engine = create_engine(config.postgres_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
