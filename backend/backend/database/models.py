import datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import DECIMAL, Date, DateTime, String, Boolean
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
    date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)
    asset: Mapped[str] = mapped_column(String, nullable=False)
    price: Mapped[Decimal] = mapped_column(DECIMAL, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(DECIMAL, nullable=False)
    fees: Mapped[Decimal] = mapped_column(DECIMAL, nullable=False)
    cost: Mapped[Decimal] = mapped_column(DECIMAL, nullable=False)
    value: Mapped[Decimal] = mapped_column(DECIMAL, nullable=False)
    excluded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class Position(Base):
    """Stores the current positions across each asset"""

    __tablename__ = "positions"

    asset: Mapped[str] = mapped_column(String, primary_key=True)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    average_price: Mapped[Decimal] = mapped_column(DECIMAL, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(DECIMAL, nullable=False)
    cost: Mapped[Decimal] = mapped_column(DECIMAL, nullable=False)


class HistoricalPrice(Base):
    """Stores daily historical close price for each asset"""

    __tablename__ = "prices_historical"

    asset: Mapped[str] = mapped_column(String, primary_key=True)
    date: Mapped[datetime.date] = mapped_column(Date, primary_key=True)
    price: Mapped[Decimal] = mapped_column(DECIMAL)


class LivePrice(Base):
    """Cache for the latest price for each asset"""

    __tablename__ = "prices_live"

    asset: Mapped[str] = mapped_column(String, primary_key=True)
    price: Mapped[Decimal] = mapped_column(DECIMAL)
