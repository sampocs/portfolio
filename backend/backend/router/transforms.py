import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database import crud, models
from backend.scrapers import prices
from backend.router import schemas
from backend.config import config, DURATION_TO_TIMEDELTA


def get_enriched_positions(db: Session) -> list[schemas.Position]:
    """
    Enriches a DB position with price data and downstream calculated fields
    """
    positions = crud.get_all_positions(db)
    live_prices = prices.get_cached_asset_prices(db)

    enriched_positions = []
    for position in positions:
        current_price = live_prices[position.asset]
        value = current_price * position.quantity
        returns = ((value - position.cost) / position.cost) * 100

        enriched_positions.append(
            schemas.Position(
                asset=position.asset,
                current_price=current_price,
                average_price=position.average_price,
                quantity=position.quantity,
                cost=position.cost,
                value=current_price * position.quantity,
                returns=returns,
            )
        )

    return enriched_positions


def get_allocations(db: Session) -> list[schemas.Allocation]:
    """
    Returns the current and target allocations for each asset
    """
    positions = get_enriched_positions(db)
    total_value = sum(position.value for position in positions)

    return [
        schemas.Allocation(
            asset=position.asset,
            target_allocation=config.assets[position.asset].target_allocation,
            current_allocation=(position.value / total_value) * 100,
        )
        for position in positions
    ]


def get_performance(db: Session, duration: str) -> list[schemas.Performance]:
    """Returns the historical performance of the portfolio over time"""
    current_date = datetime.date.today()

    start_date = None
    if duration == "YTD":
        start_date = datetime.date(current_date.year, 1, 1)
    elif duration in DURATION_TO_TIMEDELTA.keys():
        start_date = current_date - DURATION_TO_TIMEDELTA[duration] - datetime.timedelta(days=2)  # small buffer

    query = db.query(
        models.HistoricalPosition.date,
        func.sum(models.HistoricalPosition.cost).label("total_cost"),
        func.sum(models.HistoricalPosition.value).label("total_value"),
    )
    if start_date:
        query = query.where(models.HistoricalPosition.date >= start_date)

    query = query.group_by(models.HistoricalPosition.date).order_by(models.HistoricalPosition.date)

    return [
        schemas.Performance(
            date=str(snapshot.date),
            cost=snapshot.total_cost,
            value=snapshot.total_value,
            returns=((snapshot.total_value - snapshot.total_cost) / snapshot.total_cost) * 100,
        )
        for snapshot in query.all()
    ]
