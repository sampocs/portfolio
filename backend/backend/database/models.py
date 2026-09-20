import datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import DECIMAL, Computed, Date, DateTime, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, declarative_base

Base = declarative_base()

decimal_sql_type = DECIMAL(18, 6)


class TradeAction(str, Enum):
    """Trade action: Buy or Sell"""

    BUY = "BUY"
    SELL = "SELL"


class TradeAccount(str, Enum):
    """Account a trade was made in: taxable brokerage or backdoor Roth"""

    BROKERAGE = "brokerage"
    ROTH = "roth"


class HoldingPeriod(str, Enum):
    """Holding period of a matched tax lot slice"""

    LONG_TERM = "long_term"
    SHORT_TERM = "short_term"


class Trade(Base):
    """Stores all individual trades"""

    __tablename__ = "trades"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    # Where the trade was originally executed - immutable, and how each scraper finds
    # its own watermark. Never rewritten after insert.
    platform: Mapped[str] = mapped_column(String, nullable=False)
    # Where the shares are held now. Equal to `platform` until a transfer moves the
    # shares elsewhere, at which point only a buy can diverge from its platform - a
    # sell always executes where the shares are currently held.
    custodian: Mapped[str] = mapped_column(String, nullable=False)
    date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)
    asset: Mapped[str] = mapped_column(String, nullable=False)
    price: Mapped[Decimal] = mapped_column(decimal_sql_type, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(decimal_sql_type, nullable=False)
    fees: Mapped[Decimal] = mapped_column(decimal_sql_type, nullable=False)
    cost: Mapped[Decimal] = mapped_column(decimal_sql_type, nullable=False)
    value: Mapped[Decimal] = mapped_column(decimal_sql_type, nullable=False)
    excluded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    account: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default=TradeAccount.BROKERAGE.value,
        server_default=TradeAccount.BROKERAGE.value,
    )


class Position(Base):
    """Stores the current positions across each asset"""

    __tablename__ = "positions"

    asset: Mapped[str] = mapped_column(String, primary_key=True)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    average_price: Mapped[Decimal] = mapped_column(decimal_sql_type, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(decimal_sql_type, nullable=False)
    cost: Mapped[Decimal] = mapped_column(decimal_sql_type, nullable=False)


class HistoricalPosition(Base):
    """Stores the historical position info for each date"""

    __tablename__ = "historical_positions"

    asset: Mapped[str] = mapped_column(String, primary_key=True)
    date: Mapped[datetime.date] = mapped_column(Date, primary_key=True)
    average_position_price: Mapped[Decimal] = mapped_column(
        decimal_sql_type, nullable=False
    )
    daily_close_price: Mapped[Decimal] = mapped_column(decimal_sql_type, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(decimal_sql_type, nullable=False)
    cost: Mapped[Decimal] = mapped_column(decimal_sql_type, nullable=False)
    value: Mapped[Decimal] = mapped_column(decimal_sql_type, nullable=False)
    returns: Mapped[Decimal] = mapped_column(decimal_sql_type, nullable=False)


class HistoricalPrice(Base):
    """Stores daily historical close price for each asset"""

    __tablename__ = "historical_prices"

    asset: Mapped[str] = mapped_column(String, primary_key=True)
    date: Mapped[datetime.date] = mapped_column(Date, primary_key=True)
    price: Mapped[Decimal] = mapped_column(decimal_sql_type)


class LivePrice(Base):
    """Cache for the latest price for each asset"""

    __tablename__ = "prices_live"

    asset: Mapped[str] = mapped_column(String, primary_key=True)
    price: Mapped[Decimal] = mapped_column(decimal_sql_type)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        # The default must be a callable - passing now() directly would freeze the
        # timestamp at import time, stamping every row with the process boot time
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
    )


class TaxLot(Base):
    """Stores one row per slice of a buy lot consumed by a brokerage sell"""

    __tablename__ = "tax_lots"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    platform: Mapped[str] = mapped_column(String, nullable=False)
    account: Mapped[str] = mapped_column(String, nullable=False)
    asset: Mapped[str] = mapped_column(String, nullable=False)
    holding_period: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    date_acquired: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    date_sold: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(decimal_sql_type, nullable=False)
    acquisition_price: Mapped[Decimal] = mapped_column(decimal_sql_type, nullable=False)
    sale_price: Mapped[Decimal] = mapped_column(decimal_sql_type, nullable=False)
    proceeds: Mapped[Decimal] = mapped_column(decimal_sql_type, nullable=False)
    cost: Mapped[Decimal] = mapped_column(decimal_sql_type, nullable=False)
    gain_loss: Mapped[Decimal] = mapped_column(
        decimal_sql_type, Computed("proceeds - cost")
    )
