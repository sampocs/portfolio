"""
One-off migration to add the `account` column to `trades`, tag the historical Roth
trades, and create the `tax_lots` table, following the `repair_prices.py` precedent.
Run once against prod with:

    python -m backend.bootstrap.add_trade_accounts

The Roth trade ids below were identified by matching the raw Vanguard export (account
19361123) against the DB by asset, quantity, and price - see the tax lots design doc's
Migration section for the full mapping.
"""

from sqlalchemy import bindparam, text
from sqlalchemy.orm import Session

from backend.config import logger
from backend.database import connection, models

ROTH_TRADE_IDS = [
    "vanguard-337",
    "vanguard-339",
    "vanguard-343",
    "vanguard-455",
    "vanguard-456",
    "vanguard-457",
    "vanguard-458",
    "vanguard-459",
    "vanguard-460",
    "vanguard-461",
    "vanguard-491",
    "vanguard-492",
    "vanguard-493",
    "vanguard-494",
    "vanguard-495",
    "vanguard-496",
    "vanguard-497",
    "vanguard-498",
    "vanguard-499",
]


def _add_account_column(db: Session):
    """Adds the `account` column to `trades`, skipped if it already exists"""
    exists = db.execute(
        text("""
            select 1 from information_schema.columns
            where table_name = 'trades' and column_name = 'account'
        """)
    ).scalar()
    if exists:
        logger.info("`account` column already exists on trades, skipping")
        return

    logger.info("Adding `account` column to trades...")
    db.execute(
        text(
            "alter table trades add column account varchar not null "
            f"default '{models.TradeAccount.BROKERAGE.value}'"
        )
    )


def _tag_roth_trades(db: Session):
    """Tags the historical Roth trades identified against the raw Vanguard export"""
    logger.info(f"Tagging {len(ROTH_TRADE_IDS)} trades as Roth...")
    statement = text(
        "update trades set account = :account where id in :ids"
    ).bindparams(bindparam("ids", expanding=True))
    db.execute(
        statement,
        {"account": models.TradeAccount.ROTH.value, "ids": ROTH_TRADE_IDS},
    )


def _print_roth_share_totals(db: Session):
    """Prints per-asset Roth share totals so they can be eyeballed against the export"""
    rows = db.execute(
        text(
            "select asset, sum(quantity) as total_quantity from trades "
            f"where account = '{models.TradeAccount.ROTH.value}' "
            "group by asset order by asset"
        )
    ).all()

    print("Roth share totals by asset:")
    for asset, total_quantity in rows:
        print(f"  {asset}: {total_quantity}")


def main():
    with connection.SessionLocal() as db:
        _add_account_column(db)
        _tag_roth_trades(db)
        db.commit()

        logger.info("Creating tax_lots table...")
        models.Base.metadata.create_all(connection.engine)

        _print_roth_share_totals(db)


if __name__ == "__main__":
    main()
