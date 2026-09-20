import datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database import crud, models
from backend.scrapers import prices
from backend.router import schemas
from backend.config import config, DURATION_TO_TIMEDELTA, VALID_DURATIONS


def window_start_date(duration: str, today: datetime.date) -> datetime.date | None:
    """
    Returns the first date of a duration's window, with no buffer (unlike
    `get_performance`, which pads by 2 days). `YTD` starts on Jan 1st of `today`'s
    year, `ALL` has no start (returns `None`), and every other duration starts
    `DURATION_TO_TIMEDELTA[duration]` before `today`.
    """
    if duration == "YTD":
        return datetime.date(today.year, 1, 1)
    if duration == "ALL":
        return None
    return today - DURATION_TO_TIMEDELTA[duration]


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

        # A trade can be marked excluded after the last positions sync, leaving a
        # position row with no non-excluded trades and thus no entry here.
        cash_flow = cash_flows.get(
            position.asset, crud.CashFlow(buys=Decimal(0), sells=Decimal(0))
        )
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
        position.current_allocation = (
            (position.value / total_value) * 100 if total_value != 0 else Decimal(0)
        )

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


# Points per watch list sparkline; enough to show the shape of a year at 64pt wide
SPARKLINE_POINTS = 40


def get_watchlist(db: Session) -> list[schemas.WatchlistAsset]:
    """
    Returns one entry per `config.watchlist_assets` (target_allocation > 0, yaml
    order), each with the live price, the percent change from every
    `VALID_DURATIONS` reference close to that live price, and a downsampled
    sparkline of closes over each duration's window.
    """
    today = datetime.date.today()
    live_prices = prices.get_cached_asset_prices(db)

    watchlist = []
    for asset in config.watchlist_assets:
        asset_config = config.assets[asset]
        current_price = live_prices[asset]
        closes = crud.get_close_prices_ascending(db, asset=asset)

        changes = {
            duration: _reference_change(
                db,
                asset=asset,
                duration=duration,
                today=today,
                current_price=current_price,
            )
            for duration in VALID_DURATIONS
        }
        sparklines = {
            duration: _sparkline(
                closes=closes,
                duration=duration,
                today=today,
                current_price=current_price,
            )
            for duration in VALID_DURATIONS
        }

        watchlist.append(
            schemas.WatchlistAsset(
                asset=asset,
                description=asset_config.description,
                market=asset_config.market.value,
                current_price=current_price,
                changes=changes,
                sparklines=sparklines,
            )
        )

    return watchlist


def _sparkline(
    closes: list[tuple[datetime.date, Decimal]],
    duration: str,
    today: datetime.date,
    current_price: Decimal,
) -> list[Decimal]:
    """
    The closes inside a duration's window followed by the live price, thinned to at
    most `SPARKLINE_POINTS` evenly spaced values. `closes` must be ascending by date.
    """
    start_date = window_start_date(duration=duration, today=today)
    window = [
        price for date, price in closes if start_date is None or date >= start_date
    ]
    return _downsample(values=window + [current_price], points=SPARKLINE_POINTS)


def _downsample(values: list[Decimal], points: int) -> list[Decimal]:
    """Keeps at most `points` evenly spaced values, always including the first and last"""
    if len(values) <= points:
        return values

    step = (len(values) - 1) / (points - 1)
    return [values[round(index * step)] for index in range(points)]


def _reference_change(
    db: Session,
    asset: str,
    duration: str,
    today: datetime.date,
    current_price: Decimal,
) -> Decimal:
    """
    Percent move from a duration's reference close to `current_price`. The reference
    is the earliest stored close for `ALL`, otherwise the close on or before the
    duration's window start date. `0` when there is no reference row or it is `0`.
    """
    if duration == "ALL":
        reference = crud.get_earliest_close_price(db, asset=asset)
        return (
            (current_price - reference) / reference * 100 if reference else Decimal(0)
        )

    start_date = window_start_date(duration=duration, today=today)
    assert start_date is not None, f"'{duration}' has a start date; only 'ALL' does not"
    reference = crud.get_close_price_on_or_before(db, asset=asset, date=start_date)

    if not reference:
        return Decimal(0)

    return (current_price - reference) / reference * 100


def get_asset_performance(
    db: Session, asset: str, duration: str
) -> schemas.AssetPerformance:
    """
    Returns one asset's value history and cash-flow baseline from `duration`'s window
    start to today. `start_date` is that window start, clamped forward to the latest
    date with a stored `HistoricalPosition` row when the window start is later than
    that (rows are only built through `last_price_date` by the daily position-history
    job, so a raw window start can be ahead of the data for `1D` before that job runs,
    or on a day it fails). `start_value` is the `HistoricalPosition.value` on
    `start_date`, or `0` when the asset held no position that day. `start_buys`/
    `start_sells` are cumulative trade cash flows through `start_date` inclusive,
    independent of whether a position row exists. `history` covers every
    `HistoricalPosition` row from `start_date` onward, each with its own cumulative
    buys/sells. Gain is left for the caller to compute.
    """
    today = datetime.date.today()
    window_start = window_start_date(duration=duration, today=today)
    assert window_start is not None, (
        f"'{duration}' has no start date; ASSET_DURATIONS must exclude 'ALL'"
    )

    latest_built_date = db.query(func.max(models.HistoricalPosition.date)).scalar()
    start_date = (
        latest_built_date
        if latest_built_date is not None and latest_built_date < window_start
        else window_start
    )

    start_position = (
        db.query(models.HistoricalPosition.value)
        .where(models.HistoricalPosition.asset == asset)
        .where(models.HistoricalPosition.date == start_date)
        .first()
    )
    start_value = start_position[0] if start_position else Decimal(0)

    history_rows = (
        db.query(models.HistoricalPosition)
        .where(models.HistoricalPosition.asset == asset)
        .where(models.HistoricalPosition.date >= start_date)
        .order_by(models.HistoricalPosition.date)
        .all()
    )

    # Cash flows are trade-derived and independent of the history rows, so the
    # running baseline is computed once over [start_date, *history dates]
    daily_cash_flows = crud.get_daily_cash_flows(db, assets=[asset])
    running_cash_flows = _accumulate_running_cash_flows(
        dates=[start_date] + [row.date for row in history_rows],
        daily_cash_flows=daily_cash_flows,
    )
    start_cash_flow, history_cash_flows = running_cash_flows[0], running_cash_flows[1:]

    history = [
        schemas.AssetPerformancePoint(
            date=str(row.date),
            value=row.value,
            buys=cash_flow.buys,
            sells=cash_flow.sells,
        )
        for row, cash_flow in zip(history_rows, history_cash_flows)
    ]

    return schemas.AssetPerformance(
        start_date=str(start_date),
        start_value=start_value,
        start_buys=start_cash_flow.buys,
        start_sells=start_cash_flow.sells,
        history=history,
    )
