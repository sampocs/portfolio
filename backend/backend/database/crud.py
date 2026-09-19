import datetime
from collections import defaultdict
from dataclasses import dataclass
from sqlalchemy.orm import Session
from backend.database import models
from decimal import Decimal
from dateutil.relativedelta import relativedelta
from backend import lots
from backend.config import config
from tqdm import tqdm  # type: ignore


@dataclass
class CashFlow:
    """Total cash moved by trades: what was paid out (buys) and taken in (sells)"""

    buys: Decimal
    sells: Decimal


@dataclass
class DailyCashFlow:
    """A single trade date's buys and sells, not cumulative"""

    date: datetime.date
    buys: Decimal
    sells: Decimal


def get_trades(
    db: Session, asset: str | None = None, date: datetime.date | None = None
):
    """Returns all trades with optional asset filter"""
    query = db.query(models.Trade).where(models.Trade.excluded.is_(False))
    if asset:
        query = query.where(models.Trade.asset == asset)
    if date:
        query = query.where(models.Trade.date == date)
    return query.all()


def get_cash_flows(db: Session, assets: list[str] | None = None) -> dict[str, CashFlow]:
    """
    Returns total buys and sells (Trade.cost) per asset, over non-excluded trades.
    Optional asset filter narrows which trades are considered.
    """
    trades = _get_non_excluded_trades(db, assets=assets)

    cash_flows: dict[str, CashFlow] = {}
    for trade in trades:
        cash_flow = cash_flows.setdefault(
            trade.asset, CashFlow(buys=Decimal(0), sells=Decimal(0))
        )
        if trade.action == models.TradeAction.BUY:
            cash_flow.buys += trade.cost
        else:
            cash_flow.sells += trade.cost

    return cash_flows


def get_daily_cash_flows(
    db: Session, assets: list[str] | None = None
) -> list[DailyCashFlow]:
    """
    Returns buys and sells (Trade.cost) for each trade date, ascending, over
    non-excluded trades. Each entry covers only that single date, not a cumulative
    total. Optional asset filter narrows which trades are considered.
    """
    trades = _get_non_excluded_trades(db, assets=assets)

    cash_flows_by_date: dict[datetime.date, DailyCashFlow] = {}
    for trade in trades:
        cash_flow = cash_flows_by_date.setdefault(
            trade.date,
            DailyCashFlow(date=trade.date, buys=Decimal(0), sells=Decimal(0)),
        )
        if trade.action == models.TradeAction.BUY:
            cash_flow.buys += trade.cost
        else:
            cash_flow.sells += trade.cost

    return sorted(cash_flows_by_date.values(), key=lambda flow: flow.date)


def _get_non_excluded_trades(
    db: Session, assets: list[str] | None
) -> list[models.Trade]:
    """Fetches non-excluded trades, optionally filtered to a set of assets"""
    query = db.query(models.Trade).where(models.Trade.excluded.is_(False))
    if assets:
        query = query.where(models.Trade.asset.in_(assets))
    return query.all()


def get_historical_prices(db: Session, asset: str, limit: int = 365 * 5):
    """Returns all prices for a particular asset"""
    return (
        db.query(models.HistoricalPrice)
        .where(models.HistoricalPrice.asset == asset)
        .order_by(models.HistoricalPrice.date.desc())
        .limit(limit)
    )


def get_live_price(db: Session, asset: str) -> tuple[Decimal, datetime.datetime]:
    """Returns the live price for an asset"""
    price = (
        db.query(models.LivePrice.price, models.LivePrice.updated_at)
        .where(models.LivePrice.asset == asset)
        .first()
    )
    assert price, f"No live price found for {asset}"
    return price[0], price[1]


def get_all_positions(db: Session):
    """Returns all active positions"""
    return db.query(models.Position).all()


def build_positions_from_trades(
    db: Session, end_date: str | None = None
) -> list[models.Position]:
    """
    Builds the current portfolio positions from the trade history on the specified dates
    Dates are inclusive on both ends
    Returns a list of Position objects, one for each asset
    """
    end_date = end_date or datetime.date.today().isoformat()
    trades = (
        db.query(models.Trade)
        .where(models.Trade.date <= end_date)
        .order_by(models.Trade.date)
        .all()
    )
    matchable_trades = [trade for trade in trades if trade.asset in config.assets]

    matches = lots.match_lots(matchable_trades)
    return positions_from_matches(matches)


def positions_from_matches(matches: lots.LotMatches) -> list[models.Position]:
    """
    Aggregates matched open lots into one Position per asset, pooling across accounts
    and platforms. Cost is the sum of each remaining lot's quantity times its buy price;
    average price is cost divided by quantity. Assets fully sold out (zero remaining
    quantity) still produce a position, with quantity, cost, and average_price all zero,
    so realized-only assets aren't dropped from downstream totals. Assets with no
    matchable (non-excluded) trades at all produce no position.
    """
    # An asset with at least one non-excluded trade normally gets a key in
    # matches.open_lots, even fully sold out (its open lots list ends up empty). Also
    # pull asset names from the matched slices so a fully sold asset still produces a
    # row even if that weren't the case.
    assets = set(matches.open_lots.keys()) | {
        lot_slice.buy.asset for lot_slice in matches.slices
    }

    positions = []
    for asset in sorted(assets):
        open_lots = matches.open_lots.get(asset, [])
        total_quantity = sum((lot.quantity for lot in open_lots), Decimal(0))

        if total_quantity == 0:
            total_cost = Decimal(0)
            average_price = Decimal(0)
        else:
            total_cost = sum(
                (lot.quantity * lot.buy.price for lot in open_lots), Decimal(0)
            )
            average_price = total_cost / total_quantity

        positions.append(
            models.Position(
                asset=asset,
                updated_at=datetime.datetime.now(datetime.timezone.utc),
                average_price=average_price,
                quantity=total_quantity,
                cost=total_cost,
            )
        )

    return positions


def enrich_historical_position(
    db: Session, date: str, position: models.Position
) -> models.HistoricalPosition:
    """Enrich a position with the historical price and downstream calculations"""
    asset_match = models.HistoricalPrice.asset == position.asset
    date_match = models.HistoricalPrice.date == date
    daily_close_price = (
        db.query(models.HistoricalPrice.price)
        .where(asset_match)
        .where(date_match)
        .scalar()
    )

    if position.quantity != 0:
        assert daily_close_price, (
            f"Daily close price not found for {position.asset} on {date}"
        )
    else:
        daily_close_price = Decimal(0)

    value = position.quantity * daily_close_price
    returns = (value - position.cost) / position.cost * 100

    return models.HistoricalPosition(
        asset=position.asset,
        date=date,
        average_position_price=position.average_price,
        daily_close_price=daily_close_price,
        quantity=position.quantity,
        cost=position.cost,
        value=value,
        returns=returns,
    )


def build_historical_positions(
    db: Session, target_dates: list[str], log_progress: bool = False
) -> list[models.HistoricalPosition]:
    """
    Build the historical positions table for each of the specified dates. Zero-quantity
    (fully sold) positions are skipped here, before enriching, so the table's per-asset
    `returns` (unrealized gain over remaining cost) is left with no zero-cost rows.
    """
    historical_positions = []
    for end_date in (
        tqdm(target_dates, desc="Building historical positions")
        if log_progress
        else target_dates
    ):
        positions_raw = build_positions_from_trades(db, end_date=end_date)
        historical_positions += [
            enrich_historical_position(db, end_date, position)
            for position in positions_raw
            if position.quantity != 0
        ]

    return historical_positions


def store_live_prices(db: Session, price_data: dict[str, Decimal]):
    """
    Stores live price data in the DB
    Input is a mapping of asset -> price
    """
    # Clear exisiting prices
    db.query(models.LivePrice).delete()

    # Bulk insert new prices
    price_objects = [
        models.LivePrice(asset=asset, price=price)
        for (asset, price) in price_data.items()
    ]
    db.bulk_save_objects(price_objects)

    db.commit()


def store_historical_prices(db: Session, price_date: dict[str, dict[str, Decimal]]):
    """
    Stores historical prices in the DB
    Input is a mapping of asset -> date -> price
    """
    price_objects = []
    for asset, price_by_date in price_date.items():
        for date, price in price_by_date.items():
            price_objects.append(
                models.HistoricalPrice(date=date, asset=asset, price=price)
            )

    db.bulk_save_objects(price_objects)
    db.commit()


def store_positions(db: Session, positions: list[models.Position]):
    """Stores the current position records, overwriting anything currently in the DB"""
    db.query(models.Position).delete()
    db.bulk_save_objects(positions)
    db.commit()


def build_tax_lots(matches: lots.LotMatches) -> list[models.TaxLot]:
    """
    Builds one TaxLot row per lot slice whose sell was made in the brokerage account.
    Roth sells produce no rows, since Roth gains aren't taxable. Ids count slices within
    a sell from 0, so they stay stable across rebuilds. Proceeds and cost prorate each
    side's fees and value by the slice's share of the sell's and buy's total quantity.
    """
    slice_index_by_sell: dict[str, int] = defaultdict(int)
    tax_lots: list[models.TaxLot] = []

    for lot_slice in matches.slices:
        sell = lot_slice.sell
        if sell.account != models.TradeAccount.BROKERAGE.value:
            continue

        buy = lot_slice.buy
        quantity = lot_slice.quantity
        slice_index = slice_index_by_sell[sell.id]
        slice_index_by_sell[sell.id] += 1

        date_acquired = buy.date
        date_sold = sell.date
        holding_period = (
            models.HoldingPeriod.LONG_TERM
            if date_sold > date_acquired + relativedelta(years=1)
            else models.HoldingPeriod.SHORT_TERM
        )

        proceeds = (sell.value - sell.fees) * quantity / sell.quantity
        cost = (buy.value + buy.fees) * quantity / buy.quantity

        tax_lots.append(
            models.TaxLot(
                id=f"{sell.id}-{slice_index}",
                platform=sell.platform,
                account=sell.account,
                asset=sell.asset,
                holding_period=holding_period.value,
                # The description keeps the slice's full-precision quantity on purpose
                # (matching how a 1099-B prints it), even though the `quantity` column
                # rounds to 6 decimals
                description=f"{_format_quantity(quantity)} {sell.asset}",
                date_acquired=date_acquired,
                date_sold=date_sold,
                quantity=quantity,
                acquisition_price=buy.price,
                sale_price=sell.price,
                proceeds=proceeds,
                cost=cost,
            )
        )

    return tax_lots


def _format_quantity(quantity: Decimal) -> str:
    """Formats a decimal quantity without trailing zeros or scientific notation"""
    text = f"{quantity:f}"
    if "." not in text:
        return text
    return text.rstrip("0").rstrip(".")


def store_tax_lots(db: Session, tax_lots: list[models.TaxLot]):
    """Stores the tax lot records, overwriting anything currently in the DB"""
    db.query(models.TaxLot).delete()
    db.bulk_save_objects(tax_lots)
    db.commit()


def store_historical_positions(
    db: Session, historical_positions: list[models.HistoricalPosition]
):
    """Stores historical positiosn in the DB"""
    db.bulk_save_objects(historical_positions)
    db.commit()


def store_trades(db: Session, trades: list[models.Trade]):
    """Stores trades in the DB"""
    if not trades:
        return

    for trade in trades:
        db.merge(trade)
    db.commit()


def get_latest_asset_price(db: Session, asset: str, date: str) -> Decimal:
    """Retrieves the latest price for the given asset before the specified date"""
    previous_price = (
        db.query(models.HistoricalPrice.price)
        .filter(models.HistoricalPrice.asset == asset)
        .filter(models.HistoricalPrice.date < date)
        .order_by(models.HistoricalPrice.date.desc())
        .first()
    )

    assert previous_price, f"No previous price found for {asset} before {date}"
    return previous_price[0]
