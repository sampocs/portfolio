"""
One-off migration to add the `custodian` column to `trades`, following the
`add_trade_accounts.py` precedent. Run once against prod with:

    python -m backend.bootstrap.add_trade_custodians

`platform` keeps its current meaning (where a trade was originally executed) and is
never rewritten here. `custodian` starts out equal to `platform` for every row - they
only diverge once a transfer moves shares between custodians, which happens later via
the `replatform` command.

There is no sensible single default for a brand-new `custodian` column, so it is added
nullable, backfilled from `platform`, and only then set `not null` - unlike `account` in
`add_trade_accounts.py`, which had one.

Ordering matters: this script must run against prod BEFORE the code that declares
`custodian` as `not null` is deployed/merged. Nothing calls `create_all` at startup, so
running the migration first only briefly breaks the old code's inserts (the next sync
retries them), whereas deploying the code first breaks every `trades` read with a 500
until this script is run by hand.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.config import logger
from backend.database import connection


def _add_custodian_column(db: Session):
    """Adds the nullable `custodian` column to `trades`, skipped if it already exists"""
    exists = db.execute(
        text("""
            select 1 from information_schema.columns
            where table_name = 'trades' and column_name = 'custodian'
        """)
    ).scalar()
    if exists:
        logger.info("`custodian` column already exists on trades, skipping")
        return

    logger.info("Adding nullable `custodian` column to trades...")
    db.execute(text("alter table trades add column custodian varchar"))


def _backfill_custodian(db: Session):
    """Backfills `custodian = platform` for every row missing a custodian"""
    logger.info("Backfilling custodian from platform...")
    db.execute(text("update trades set custodian = platform where custodian is null"))


def _set_custodian_not_null(db: Session):
    """Marks `custodian` not null now that every row has been backfilled"""
    logger.info("Setting `custodian` not null...")
    db.execute(text("alter table trades alter column custodian set not null"))


def _print_custodian_account_totals(db: Session):
    """Prints per (custodian, account) share totals so they can be eyeballed"""
    rows = db.execute(
        text(
            "select custodian, account, sum(quantity) as total_quantity from trades "
            "group by custodian, account order by custodian, account"
        )
    ).all()

    print("Share totals by custodian and account:")
    for custodian, account, total_quantity in rows:
        print(f"  {custodian}/{account}: {total_quantity}")


def main():
    with connection.SessionLocal() as db:
        _add_custodian_column(db)
        _backfill_custodian(db)
        _set_custodian_not_null(db)
        db.commit()

        _print_custodian_account_totals(db)


if __name__ == "__main__":
    main()
