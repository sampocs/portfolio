import datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database import crud, models
from backend.scrapers import prices
from backend.router import schemas
from backend.config import config, DURATION_TO_TIMEDELTA


def get_enriched_positions(db: Session) -> list[schemas.Position]:
    """
    Enriches a DB position with metadata, price data, and downstream calculated fields.
    `total_return`/`returns` are cash-out over cash-in (value plus realized sells, minus
    buys), so a fully sold (zero-quantity) position still reports its realized result.
    """
    positions = crud.get_all_positions(db)
    live_prices = prices.get_cached_asset_prices(db)
    cash_flows = crud.get_cash_flows(db)

    # Enrich each position with the current price, value, and cash-flow based returns
    enriched_positions = []
    for position in positions:
        current_price = live_prices[position.asset]
        value = current_price * position.quantity

        cash_flow = cash_flows[position.asset]
        total_return = value + cash_flow.sells - cash_flow.buys
        returns = (
            (total_return / cash_flow.buys) * 100 if cash_flow.buys != 0 else Decimal(0)
        )

        asset_config = config.assets[position.asset]

        enriched_positions.append(
            schemas.Position(
                asset=position.asset,
                market=asset_config.market.value,
                segment=asset_config.segment.value,
                description=asset_config.description,
                current_price=current_price,
                average_price=position.average_price,
                quantity=position.quantity,
                cost=position.cost,
                value=value,
                buys=cash_flow.buys,
                sells=cash_flow.sells,
                total_return=total_return,
                returns=returns,
                current_allocation=Decimal(0),  # temporary - will get updated below
                target_allocation=asset_config.target_allocation,
            )
        )

    # Get the total value and then calculate the current allocations
    total_value = sum(position.value for position in enriched_positions)
    for position in enriched_positions:
        position.current_allocation = (position.value / total_value) * 100

    return enriched_positions


def get_performance(
    db: Session, duration: str, assets: list[str]
) -> list[schemas.Performance]:
    """
    Returns the historical performance of the portfolio over time. `returns` is
    cash-out over cash-in (`(value + sells - buys) / buys * 100`, 0 when `buys` is 0),
    using the running buys/sells through each date rather than the unrealized return
    over remaining cost.
    """
    current_date = datetime.date.today()

    start_date = None
    if duration == "YTD":
        start_date = datetime.date(current_date.year, 1, 1)
    elif duration in DURATION_TO_TIMEDELTA.keys():
        start_date = (
            current_date - DURATION_TO_TIMEDELTA[duration] - datetime.timedelta(days=2)
        )  # small buffer

    query = db.query(
        models.HistoricalPosition.date,
        func.sum(models.HistoricalPosition.cost).label("total_cost"),
        func.sum(models.HistoricalPosition.value).label("total_value"),
    )

    if assets:
        query = query.where(models.HistoricalPosition.asset.in_(assets))

    if start_date:
        query = query.where(models.HistoricalPosition.date >= start_date)

    query = query.group_by(models.HistoricalPosition.date).order_by(
        models.HistoricalPosition.date
    )
    snapshots = query.all()

    # Cash flows are fetched with the same asset filter but no date window, so a
    # duration that starts after some trades still accumulates the correct cumulative
    # buys/sells at each history date
    daily_cash_flows = crud.get_daily_cash_flows(db, assets=assets)
    running_cash_flows = _accumulate_running_cash_flows(
        dates=[snapshot.date for snapshot in snapshots],
        daily_cash_flows=daily_cash_flows,
    )

    performance = []
    for snapshot, cash_flow in zip(snapshots, running_cash_flows):
        total_return = snapshot.total_value + cash_flow.sells - cash_flow.buys
        returns = (
            (total_return / cash_flow.buys) * 100 if cash_flow.buys != 0 else Decimal(0)
        )

        performance.append(
            schemas.Performance(
                date=str(snapshot.date),
                cost=snapshot.total_cost,
                value=snapshot.total_value,
                buys=cash_flow.buys,
                sells=cash_flow.sells,
                returns=returns,
            )
        )

    return performance


def _accumulate_running_cash_flows(
    dates: list[datetime.date], daily_cash_flows: list[crud.DailyCashFlow]
) -> list[crud.CashFlow]:
    """
    For each date in `dates` (ascending), returns the running total buys/sells
    accumulated from every daily cash flow up to and including that date. A trade made
    on a given date counts on that date. `daily_cash_flows` must also be ascending.
    """
    running_buys = Decimal(0)
    running_sells = Decimal(0)
    flow_index = 0
    running_totals = []

    for date in dates:
        while (
            flow_index < len(daily_cash_flows)
            and daily_cash_flows[flow_index].date <= date
        ):
            running_buys += daily_cash_flows[flow_index].buys
            running_sells += daily_cash_flows[flow_index].sells
            flow_index += 1
        running_totals.append(crud.CashFlow(buys=running_buys, sells=running_sells))

    return running_totals


def get_asset_prices(db: Session, asset: str) -> schemas.AssetPriceHistory:
    """Returns the historical price history of the asset"""
    live_price, updated_at = crud.get_live_price(db, asset)
    historical_prices = crud.get_historical_prices(db, asset)

    return schemas.AssetPriceHistory(
        live_price=live_price,
        updated_at=updated_at,
        historical_prices=[
            schemas.HistoricalPrice(date=str(p.date), price=p.price)
            for p in historical_prices
        ],
    )
