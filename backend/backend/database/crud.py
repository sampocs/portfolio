from sqlalchemy.orm import Session
from backend.database import models


def get_all_trades(db: Session):
    """Returns all trades"""
    return db.query(models.Trade).all()
