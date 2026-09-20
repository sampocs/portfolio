"""
Moves trades between custodians when shares physically transfer from one platform to
another, e.g. an in-flight Vanguard IRA -> Robinhood Roth IRA transfer:

    make replatform FROM=vanguard TO=robinhood ACCOUNT=roth [ASSET=VT] [EXECUTE=1]

Mechanically this is one statement - `update trades set custodian = :to where custodian
= :from`, narrowed by account and optionally by asset. `platform` (where a trade was
originally executed) is never touched; only `custodian` (where the shares are held now)
moves. There is deliberately no action filter: buys and sells both move together, since
moving only the buys would strand the old custodian's sells without lots to match, and
leaving the new custodian's sells stranded the other way. Moving the whole group
replays the identical FIFO at the new custodian.

A dry run (the default) prints every affected row and per-asset net share totals, and
changes nothing. Passing EXECUTE=1 commits the update, then rebuilds tax lots so the
move's effect on FIFO matching is verified immediately.

Merging into an occupied custodian - already holding shares of an asset at the
destination and transferring more in - is normal and intentionally allowed; FIFO across
the combined history is correct.
"""

from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal

import click
from sqlalchemy import ColumnElement, update
from sqlalchemy.orm import Session

from backend import lots
from backend.config import Platform, logger
from backend.database import connection, models
from backend.jobs import jobs


@dataclass
class ReplatformResult:
    """Outcome of a `run_replatform` call, returned for both CLI reporting and tests"""

    matched_trades: list[models.Trade]
    executed: bool


def _validate_platform(value: str, *, label: str) -> None:
    """Raises ValueError naming the valid Platform values if `value` isn't one of them"""
    valid_values = [platform.value for platform in Platform]
    if value not in valid_values:
        raise ValueError(
            f"Unknown {label} platform '{value}'. Valid values: {', '.join(valid_values)}"
        )


def _filter_criteria(
    from_platform: str, account: str, asset: str | None
) -> list[ColumnElement[bool]]:
    """Shared where-clause for both the preview query and the actual update"""
    criteria = [
        models.Trade.custodian == from_platform,
        models.Trade.account == account,
    ]
    if asset:
        criteria.append(models.Trade.asset == asset)
    return criteria


def _matching_trades(
    db: Session, *, from_platform: str, account: str, asset: str | None
) -> list[models.Trade]:
    """Returns every trade currently held at `from_platform`/`account`, oldest first"""
    return (
        db.query(models.Trade)
        .filter(*_filter_criteria(from_platform, account, asset))
        .order_by(models.Trade.date, models.Trade.id)
        .all()
    )


def _print_plan(
    trades: list[models.Trade], *, from_platform: str, to_platform: str
) -> None:
    """Prints every affected row and per-asset net share totals moving to `to_platform`"""
    print(
        f"{len(trades)} trade(s) moving custodian from {from_platform} to {to_platform}:"
    )
    for trade in trades:
        print(
            f"  {trade.date} {trade.asset} {trade.action} "
            f"quantity={trade.quantity} price={trade.price}"
        )

    net_quantity_by_asset: dict[str, Decimal] = defaultdict(Decimal)
    for trade in trades:
        sign = (
            Decimal(1) if trade.action == models.TradeAction.BUY.value else Decimal(-1)
        )
        net_quantity_by_asset[trade.asset] += sign * trade.quantity

    print("Net share totals by asset:")
    for asset in sorted(net_quantity_by_asset):
        print(f"  {asset}: {net_quantity_by_asset[asset]}")


def run_replatform(
    db: Session,
    *,
    from_platform: str,
    to_platform: str,
    account: str,
    asset: str | None,
    execute: bool,
) -> ReplatformResult:
    """
    Core replatform logic, kept independent of the click CLI so it's directly
    unit-testable against an in-memory session.

    Validates both platform values, reports an empty match as a no-op, and - only when
    `execute` is set - commits the custodian move and rebuilds tax lots, reporting any
    unmatched sell the rebuild surfaces rather than crashing with a bare traceback.
    """
    _validate_platform(from_platform, label="source")
    _validate_platform(to_platform, label="destination")

    matched_trades = _matching_trades(
        db, from_platform=from_platform, account=account, asset=asset
    )
    if not matched_trades:
        asset_clause = f" asset={asset}" if asset else ""
        logger.info(
            f"No trades found at custodian={from_platform} account={account}{asset_clause} "
            "- nothing to do"
        )
        return ReplatformResult(matched_trades=[], executed=False)

    _print_plan(matched_trades, from_platform=from_platform, to_platform=to_platform)

    if not execute:
        print("Dry run only - no changes made. Pass EXECUTE=1 to commit.")
        return ReplatformResult(matched_trades=matched_trades, executed=False)

    statement = (
        update(models.Trade)
        .where(*_filter_criteria(from_platform, account, asset))
        .values(custodian=to_platform)
    )
    db.execute(statement)
    db.commit()
    logger.info(
        f"Moved {len(matched_trades)} trade(s) from custodian={from_platform} "
        f"to custodian={to_platform}"
    )

    try:
        jobs.rebuild_tax_lots(db)
    except lots.UnmatchedSellError as e:
        logger.error(f"Tax lot rebuild found an unmatched sell after the move: {e}")

    return ReplatformResult(matched_trades=matched_trades, executed=True)


@click.command()
@click.option(
    "--from", "from_platform", required=True, help="Custodian to move trades from."
)
@click.option("--to", "to_platform", required=True, help="Custodian to move trades to.")
@click.option(
    "--account",
    required=True,
    help="Account whose trades to move, e.g. brokerage or roth.",
)
@click.option("--asset", default=None, help="Optional asset symbol to narrow the move.")
@click.option(
    "--execute",
    is_flag=True,
    default=False,
    help="Commit the move. Without this, only a dry-run plan is printed.",
)
def main(
    from_platform: str,
    to_platform: str,
    account: str,
    asset: str | None,
    execute: bool,
) -> None:
    """Moves every trade at a custodian/account (optionally one asset) to a new custodian."""
    with connection.SessionLocal() as db:
        run_replatform(
            db,
            from_platform=from_platform,
            to_platform=to_platform,
            account=account,
            asset=asset,
            execute=execute,
        )


if __name__ == "__main__":
    main()
