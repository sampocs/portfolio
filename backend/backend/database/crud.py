import datetime
from sqlalchemy.orm import Session
from backend.database import models
from decimal import Decimal
from collections import defaultdict


def get_all_trades(db: Session):
    """Returns all trades"""
    return db.query(models.Trade).all()


def get_all_positions(db: Session):
    """Returns all active positions"""
    return db.query(models.Position).all()


def build_position_from_trades(db: Session):
    """Builds the current portfolio positions from the trade history"""
    trades = get_all_trades(db)

    # Group trades by asset
    asset_trades = defaultdict(list)
    for trade in trades:
        asset_trades[trade.asset].append(trade)

    # Clear existing positions
    db.query(models.Position).delete()

    # Calculate position for each asset
    for asset, trades_list in asset_trades.items():
        total_quantity = Decimal(0)
        total_cost = Decimal(0)

        for trade in trades_list:
            if trade.action == models.TradeAction.BUY:
                total_quantity += trade.quantity
                total_cost += trade.cost
            elif trade.action == models.TradeAction.SELL:
                total_quantity -= trade.quantity
                total_cost -= trade.cost

        # Only create position if we still hold the asset
        if total_quantity == 0:
            continue

        average_price = total_cost / total_quantity

        position = models.Position(
            asset=asset,
            updated_at=datetime.datetime.now(datetime.timezone.utc),
            average_price=average_price,
            quantity=total_quantity,
            cost=total_cost,
        )
        db.add(position)

    db.commit()


def store_live_prices(db: Session, price_data: dict[str, Decimal]):
    """Stores live price data in the DB"""
    price_objects = [models.LivePrice(asset=asset, price=price) for (asset, price) in price_data.items()]
    db.bulk_save_objects(price_objects)
