from datetime import datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import DECIMAL, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class TradeAction(str, Enum):
    """Trade action: Buy or Sell"""

    BUY = "BUY"
    SELL = "SELL"


class Trade(Base):
    """Stores all individual trades"""

    __tablename__ = "trades"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    platform: Mapped[str] = mapped_column(String, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)
    asset: Mapped[str] = mapped_column(String, nullable=False)
    price: Mapped[Decimal] = mapped_column(DECIMAL, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(DECIMAL, nullable=False)
    fees: Mapped[Decimal] = mapped_column(DECIMAL, nullable=False)
    cost: Mapped[Decimal] = mapped_column(DECIMAL, nullable=False)
    value: Mapped[Decimal] = mapped_column(DECIMAL, nullable=False)


class Position(Base):
    """Stores the current positions across each asset"""

    __tablename__ = "positions"

    asset: Mapped[str] = mapped_column(String, primary_key=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    current_price: Mapped[Decimal] = mapped_column(DECIMAL, nullable=False)
    average_price: Mapped[Decimal] = mapped_column(DECIMAL, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(DECIMAL, nullable=False)
    cost: Mapped[Decimal] = mapped_column(DECIMAL, nullable=False)
    value: Mapped[Decimal] = mapped_column(DECIMAL, nullable=False)
    returns: Mapped[Decimal] = mapped_column(DECIMAL, nullable=False)
