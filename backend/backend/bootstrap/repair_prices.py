"""
One-off repair for historical price data, built after the VO 4-for-1 split on
2026-04-21 went unhandled and a July backfill froze weekend/holiday closes at
stale values.

The repair:
1. Refetches each stock's daily history from Tiingo to learn the true trading
   days and any split factors.
2. For assets with splits: rebuilds the whole price series from Tiingo closes,
   split-adjusted into today's share terms.
   For all other assets: keeps stored trading-day closes and rewrites
   non-trading-day rows as a carry-forward of the prior close.
3. Adjusts pre-split trades (price / factor, quantity * factor) so positions
   built from trades reflect post-split share counts.
4. Repairs historical position rows and rebuilds current positions.

All changes run in a single transaction: --dry-run applies them, reports, and
rolls back, so the report reflects exactly what a real run would write.
"""

import datetime
from dataclasses import dataclass
from decimal import Decimal

import click
import requests
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.config import config, logger
from backend.database import connection, crud, models

PRICE_PRECISION = Decimal("0.000001")

# A trade needs split adjustment when its price is clearly in pre-split terms,
# i.e. the ratio of trade price to the adjusted close is near the split factor
# rather than near 1. Anything above half the factor is unambiguous for 2:1+.
TRADE_ADJUSTMENT_RATIO_THRESHOLD = Decimal("0.5")


@dataclass
class Split:
    asset: str
    ex_date: str
    factor: Decimal


def _fetch_tiingo_history(asset: str) -> list[dict]:
    """Fetches the full daily price history (with split factors) for one asset"""
    headers = {"Authorization": f"Token {config.tilingo_api_token}"}
    params = {"startDate": "1990-01-01"}

    response = requests.get(
        config.tilingo_prev_close_api.format(asset), params=params, headers=headers
    )
    response_data = response.json()
    assert isinstance(response_data, list), (
        f"Bad Tiingo response for {asset}: {response_data}"
    )
    return response_data


def _split_adjusted_closes(
    history: list[dict],
) -> tuple[dict[str, Decimal], list[Split]]:
    """
    Returns trading-day closes adjusted into current share terms, plus any splits found.
    Tiingo's splitFactor sits on the ex-date row and applies to all earlier dates,
    so we walk backwards accumulating the factor.
    """
    closes: dict[str, Decimal] = {}
    splits: list[Split] = []

    accumulated_factor = Decimal(1)
    for entry in reversed(history):
        date = entry["date"][:10]
        closes[date] = (Decimal(str(entry["close"])) / accumulated_factor).quantize(
            PRICE_PRECISION
        )

        split_factor = Decimal(str(entry.get("splitFactor", 1)))
        if split_factor != 1:
            splits.append(Split(asset="", ex_date=date, factor=split_factor))
            accumulated_factor *= split_factor

    return closes, splits


def _build_corrected_series(
    stored: list[tuple[str, Decimal]],
    tiingo_closes: dict[str, Decimal],
    rebuild_trading_days: bool,
) -> dict[str, Decimal]:
    """
    Returns the corrected price for every stored date.
    Trading days come from Tiingo (split assets) or keep their stored value;
    non-trading days carry forward the previous corrected value, which fixes
    rows frozen at stale prices by past backfills.
    """
    corrected: dict[str, Decimal] = {}
    previous_price: Decimal | None = None

    # Dates before Tiingo's coverage begins (e.g. an asset that moved exchanges)
    # have no ground truth for what's a trading day - leave them untouched
    first_tiingo_date = min(tiingo_closes)

    for date, stored_price in stored:
        if date < first_tiingo_date:
            price = stored_price
        elif date in tiingo_closes:
            price = tiingo_closes[date] if rebuild_trading_days else stored_price
        else:
            price = previous_price if previous_price is not None else stored_price
        corrected[date] = price
        previous_price = price

    return corrected


def _repair_asset_prices(db: Session, asset: str) -> list[Split]:
    """Repairs one asset's historical price rows, returning any splits discovered"""
    history = _fetch_tiingo_history(asset)
    tiingo_closes, splits = _split_adjusted_closes(history)
    for split in splits:
        split.asset = asset

    stored_rows = (
        db.query(models.HistoricalPrice.date, models.HistoricalPrice.price)
        .filter(models.HistoricalPrice.asset == asset)
        .order_by(models.HistoricalPrice.date)
        .all()
    )
    stored = [(str(date), price) for date, price in stored_rows]

    corrected = _build_corrected_series(
        stored=stored, tiingo_closes=tiingo_closes, rebuild_trading_days=bool(splits)
    )
    changes = [
        (date, stored_price, corrected[date])
        for date, stored_price in stored
        if corrected[date] != stored_price
    ]

    logger.info(
        f"{asset}: {len(changes)} price rows to fix, splits: {splits or 'none'}"
    )
    for date, old, new in changes[:5]:
        logger.info(f"  e.g. {date}: {old:.6f} -> {new:.6f}")

    # Batch updates into single VALUES-join statements - per-row updates over the
    # network are far too slow for a full-series rewrite. Values are our own
    # date strings and Decimals, so inlining them as literals is safe.
    chunk_size = 2000
    for start in range(0, len(changes), chunk_size):
        chunk = changes[start : start + chunk_size]
        values = ",".join(f"('{date}'::date, {new})" for date, _, new in chunk)
        db.execute(
            text(f"""
                update historical_prices as hp
                set price = v.price
                from (values {values}) as v(date, price)
                where hp.asset = :asset and hp.date = v.date
            """),
            {"asset": asset},
        )
    return splits


def _adjust_trades_for_split(db: Session, split: Split):
    """
    Rewrites pre-split trades into post-split terms (price / factor, quantity * factor).
    Cost and value are unchanged. Trades already in post-split terms are detected
    via their price ratio against the adjusted close and left alone.
    """
    trades = (
        db.query(models.Trade)
        .filter(models.Trade.asset == split.asset)
        .filter(models.Trade.date < split.ex_date)
        .order_by(models.Trade.date)
        .all()
    )

    for trade in trades:
        day_after_trade = str(trade.date + datetime.timedelta(days=1))
        close_on_date = crud.get_latest_asset_price(
            db, asset=split.asset, date=day_after_trade
        )
        ratio = trade.price / close_on_date
        if ratio < split.factor * TRADE_ADJUSTMENT_RATIO_THRESHOLD:
            logger.info(
                f"  trade {trade.id} on {trade.date} already post-split, skipping"
            )
            continue

        logger.info(
            f"  trade {trade.id} on {trade.date}: "
            f"price {trade.price:.2f} -> {trade.price / split.factor:.2f}, "
            f"quantity {trade.quantity:.6f} -> {trade.quantity * split.factor:.6f}"
        )
        trade.price = (trade.price / split.factor).quantize(PRICE_PRECISION)
        trade.quantity = (trade.quantity * split.factor).quantize(PRICE_PRECISION)


def _replay_position_history(
    trades: list[models.Trade], target_dates: list[str]
) -> dict[str, tuple[Decimal, Decimal, Decimal]]:
    """
    Replays FIFO lots over the (already adjusted) trades to get the position
    at each target date. Returns date -> (average_price, quantity, cost).
    """
    buy_lots: list[dict] = []
    positions: dict[str, tuple[Decimal, Decimal, Decimal]] = {}

    trade_index = 0
    for date in target_dates:
        while trade_index < len(trades) and str(trades[trade_index].date) <= date:
            trade = trades[trade_index]
            trade_index += 1
            if trade.excluded:
                continue
            if trade.action == models.TradeAction.BUY:
                buy_lots.append({"quantity": trade.quantity, "price": trade.price})
            elif trade.action == models.TradeAction.SELL:
                remaining = trade.quantity
                while remaining > 0 and buy_lots:
                    lot = buy_lots[0]
                    if lot["quantity"] <= remaining:
                        remaining -= lot["quantity"]
                        buy_lots.pop(0)
                    else:
                        lot["quantity"] -= remaining
                        remaining = Decimal(0)

        quantity = sum(lot["quantity"] for lot in buy_lots)
        if quantity == 0:
            continue
        cost = sum(lot["quantity"] * lot["price"] for lot in buy_lots)
        positions[date] = (
            (cost / quantity).quantize(PRICE_PRECISION),
            quantity.quantize(PRICE_PRECISION),
            cost.quantize(PRICE_PRECISION),
        )

    return positions


def _repair_historical_positions_for_split(db: Session, split: Split):
    """Rewrites a split asset's historical position rows from the adjusted trades"""
    trades = (
        db.query(models.Trade)
        .filter(models.Trade.asset == split.asset)
        .order_by(models.Trade.date)
        .all()
    )
    rows = (
        db.query(models.HistoricalPosition)
        .filter(models.HistoricalPosition.asset == split.asset)
        .order_by(models.HistoricalPosition.date)
        .all()
    )

    replayed = _replay_position_history(
        trades=trades, target_dates=[str(row.date) for row in rows]
    )

    changes = []
    for row in rows:
        if str(row.date) not in replayed:
            continue
        average_price, quantity, cost = replayed[str(row.date)]
        if row.quantity == quantity and row.average_position_price == average_price:
            continue
        changes.append((str(row.date), average_price, quantity, cost))

    logger.info(
        f"{split.asset}: {len(changes)} historical position rows rewritten from adjusted trades"
    )

    # Same VALUES-join batching as the price repair - ORM per-row flushes are too slow
    db.flush()
    chunk_size = 2000
    for start in range(0, len(changes), chunk_size):
        chunk = changes[start : start + chunk_size]
        values = ",".join(
            f"('{date}'::date, {avg}, {qty}, {cost})" for date, avg, qty, cost in chunk
        )
        db.execute(
            text(f"""
                update historical_positions as hp
                set average_position_price = v.average_price,
                    quantity = v.quantity,
                    cost = v.cost
                from (values {values}) as v(date, average_price, quantity, cost)
                where hp.asset = :asset and hp.date = v.date
            """),
            {"asset": split.asset},
        )
    db.expire_all()


def _recompute_position_values(db: Session):
    """
    Syncs every historical position row's close/value/returns with the repaired
    price series (covers both the split rewrite and the stale weekend closes)
    """
    # Flush pending ORM changes (trades, split position rewrites) so the raw SQL sees them
    db.flush()

    mismatch_condition = """
        hp.daily_close_price != p.price or abs(hp.value - hp.quantity * p.price) > 0.01
    """
    mismatched = db.execute(
        text(f"""
            select count(*) from historical_positions hp
            join historical_prices p on p.asset = hp.asset and p.date = hp.date
            where {mismatch_condition}
        """)
    ).scalar()
    logger.info(f"{mismatched} historical position rows need value/returns recomputed")

    db.execute(
        text(f"""
            update historical_positions hp
            set daily_close_price = p.price,
                value = hp.quantity * p.price,
                returns = (hp.quantity * p.price - hp.cost) / hp.cost * 100
            from historical_prices p
            where p.asset = hp.asset and p.date = hp.date
              and ({mismatch_condition})
        """)
    )


@click.command()
@click.option(
    "--dry-run", is_flag=True, help="Apply, report, and roll back instead of committing"
)
def main(dry_run: bool):
    with connection.SessionLocal() as db:
        logger.info("Repairing historical prices from Tiingo...")
        splits = []
        for asset in config.stock_tickers:
            splits += _repair_asset_prices(db, asset=asset)

        for split in splits:
            logger.info(
                f"Adjusting {split.asset} trades for {split.factor}:1 split on {split.ex_date}"
            )
            _adjust_trades_for_split(db, split=split)
            _repair_historical_positions_for_split(db, split=split)

        logger.info("Recomputing historical position values...")
        _recompute_position_values(db)

        if dry_run:
            logger.info("Dry run complete, rolling back")
            db.rollback()
            return

        db.commit()

        # store_positions manages its own commit, so it runs after the main transaction
        logger.info("Rebuilding current positions from adjusted trades...")
        positions = crud.build_positions_from_trades(db)
        crud.store_positions(db, positions)
        logger.info("Repair complete")


if __name__ == "__main__":
    main()
