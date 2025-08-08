import pandas as pd
from decimal import Decimal
from sqlalchemy.dialects.postgresql import insert


from backend.database import connection, models
from backend.config import config


def backfill_trades():
    """Seeds trades table with backfilled trades"""
    vanguard_df = pd.read_csv(config.project_home / "data" / "vanguard_clean.csv")
    coinbase_df = pd.read_csv(config.project_home / "data" / "coinbase_clean.csv")
    trades_df = pd.concat([vanguard_df, coinbase_df], ignore_index=True)

    for col in ["price", "quantity", "fees", "cost", "value"]:
        trades_df[col] = trades_df[col].astype(str).map(lambda x: Decimal(x))

    records = trades_df.to_dict("records")

    with connection.engine.begin() as conn:
        for record in records:
            stmt = insert(models.Trade).values(record)
            stmt = stmt.on_conflict_do_nothing(index_elements=["id"])
            conn.execute(stmt)


def main():
    models.Base.metadata.create_all(connection.engine)
    backfill_trades()


if __name__ == "__main__":
    main()
