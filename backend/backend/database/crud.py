import datetime
from sqlalchemy.orm import Session
from backend.database import models
from decimal import Decimal
from collections import defaultdict
from backend.config import config
from tqdm import tqdm


def get_trades(db: Session, asset: str | None = None):
    """Returns all trades with optional asset filter"""
    query = db.query(models.Trade)
    if asset:
        query = query.where(models.Trade.asset == asset)
    return query.all()


def get_historical_prices(db: Session, asset: str, limit: int = 365):
    """Returns all prices for a particular asset"""
    return (
        db.query(models.HistoricalPrice)
        .where(models.HistoricalPrice.asset == asset)
        .order_by(models.HistoricalPrice.date.desc())
        .limit(limit)
    )


def get_live_price(db: Session, asset: str) -> Decimal:
    """Returns the live price for an asset"""
    price = db.query(models.LivePrice.price).where(models.LivePrice.asset == asset).first()
    assert price, f"No live price found for {asset}"
    return price[0]


def get_all_positions(db: Session):
    """Returns all active positions"""
    return db.query(models.Position).all()


def build_positions_from_trades(db: Session, end_date: str | None = None) -> list[models.Position]:
    """
    Builds the current portfolio positions from the trade history on the specified dates
    Dates are inclusive on both ends
    Returns a list of Position objects, one for each asset
    """
    end_date = end_date or datetime.date.today().isoformat()
    trades = db.query(models.Trade).where(models.Trade.date <= end_date).order_by(models.Trade.date)

    # Group trades by asset
    asset_trades = defaultdict(list)
    for trade in trades:
        if trade.asset not in config.assets.keys():
            continue
        asset_trades[trade.asset].append(trade)

    # Build position for each asset
    positions = []
    for asset, trades_list in asset_trades.items():
        # Use buy logs to correctly calculate average price when there's a sell
        buy_lots = []  # Each lot: {'quantity': Decimal, 'price': Decimal}

        for trade in trades_list:
            if trade.excluded:
                continue

            if trade.action == models.TradeAction.BUY:
                buy_lots.append({"quantity": trade.quantity, "price": trade.price})

            elif trade.action == models.TradeAction.SELL:
                remaining_to_sell = trade.quantity

                # Sell from oldest lots first (FIFO)
                while remaining_to_sell > 0 and buy_lots:
                    lot = buy_lots[0]

                    if lot["quantity"] <= remaining_to_sell:
                        # Sell entire lot
                        remaining_to_sell -= lot["quantity"]
                        buy_lots.pop(0)
                    else:
                        # Partial sell of lot
                        lot["quantity"] -= remaining_to_sell
                        remaining_to_sell = Decimal(0)

        # Calculate totals from remaining lots
        total_quantity = sum(lot["quantity"] for lot in buy_lots)
        if total_quantity == 0:
            continue

        total_cost = sum(lot["quantity"] * lot["price"] for lot in buy_lots)
        average_price = total_cost / total_quantity

        position = models.Position(
            asset=asset,
            updated_at=datetime.datetime.now(datetime.timezone.utc),
            average_price=average_price,
            quantity=total_quantity,
            cost=total_cost,
        )
        positions.append(position)

    return positions


def enrich_historical_position(db: Session, date: str, position: models.Position) -> models.HistoricalPosition:
    """Enrich a position with the historical price and downstream calculations"""
    asset_match = models.HistoricalPrice.asset == position.asset
    date_match = models.HistoricalPrice.date == date
    daily_close_price = db.query(models.HistoricalPrice.price).where(asset_match).where(date_match).scalar()

    if position.quantity != 0:
        assert daily_close_price, f"Daily close price not found for {position.asset} on {date}"
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
    Build the historical positions table for each of the specified dates
    """
    historical_positions = []
    for end_date in tqdm(target_dates, desc="Building historical positions") if log_progress else target_dates:
        positions_raw = build_positions_from_trades(db, end_date=end_date)
        historical_positions += [enrich_historical_position(db, end_date, position) for position in positions_raw]

    return historical_positions


def store_live_prices(db: Session, price_data: dict[str, Decimal]):
    """
    Stores live price data in the DB
    Input is a mapping of asset -> price
    """
    # Clear exisiting prices
    db.query(models.LivePrice).delete()

    # Bulk insert new prices
    price_objects = [models.LivePrice(asset=asset, price=price) for (asset, price) in price_data.items()]
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
            price_objects.append(models.HistoricalPrice(date=date, asset=asset, price=price))

    db.bulk_save_objects(price_objects)
    db.commit()


def store_positions(db: Session, positions: list[models.Position]):
    """Stores the current position records, overwriting anything currently in the DB"""
    db.query(models.Position).delete()
    db.bulk_save_objects(positions)
    db.commit()


def store_historical_positions(db: Session, historical_positions: list[models.HistoricalPosition]):
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
