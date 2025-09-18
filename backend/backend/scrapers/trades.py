import hashlib
import datetime
from decimal import Decimal
from ibind import IbkrClient
from dateutil import parser
from backend.config import config, Platform
from backend.database import models, crud
from coinbase.rest import RESTClient
from sqlalchemy.orm import Session


def trade_has_id_conflict(db: Session, new_trade: models.Trade) -> bool:
    """
    The values in the IBKR response can change mildly as the order is filled, but there's
    no single ID field we can use to know this for sure

    To handle this, we check if we have other trades on that date for that asset, that have
    a price/quantity within 0.01% of each other - in which case it is considered a duplicate

    Importantly, if there is a duplicate, we return that there is NO conflict
    The reason for this is that we will want to keep the same ID to allow the values
    to be overriden with the upsert

    If there is an existing trade on that date (meaning with the same ID), that does
    NOT seem to be a duplicate, then we consider that a conflict, which lets us know
    that we need to generate a new ID
    """
    existing_trades = crud.get_trades(db, asset=new_trade.asset, date=new_trade.date)
    for existing in existing_trades:
        if existing.action != new_trade.action:
            continue

        # Skip if existing values are zero (would cause division by zero)
        if existing.quantity == 0 or existing.price == 0:
            continue

        # Check if quantity and price are within 0.01% tolerance
        tolerance = Decimal("0.0001")
        qty_diff_pct = abs((existing.quantity - new_trade.quantity)) / existing.quantity
        price_diff_pct = abs((existing.price - new_trade.price)) / existing.price

        # If the trade is sufficiently different, then we have an ID conflict
        if qty_diff_pct > tolerance or price_diff_pct > tolerance:
            return True

    return False


def get_recent_ibkr_trades(db: Session, start_date: datetime.date) -> list[models.Trade]:
    """
    Scrapes recent IBKR trades
    :param start_date: First date to query orders from, inclusively
    """
    client = IbkrClient(**config.ibind_client_params)

    trades = []
    for asset_info in config.assets.values():
        if asset_info.platform != Platform.IBKR:
            continue

        contract_id = asset_info.contract_id
        assert contract_id, f"Contract ID not provided for {asset_info.asset}"

        current_date = datetime.date.today()
        days = (current_date - start_date).days + 1

        transactions_raw = client.transaction_history(config.ibkr_account_id, contract_id, "USD", days)  # type: ignore
        assert transactions_raw.data and transactions_raw.data["transactions"]  # type: ignore
        transactions: list[dict[str, str | int]] = transactions_raw.data["transactions"]  # type: ignore

        for transaction in transactions:
            if transaction["type"] not in ["Buy", "Sell"]:
                continue

            action = str(transaction["type"]).upper()
            quantity = Decimal(str(transaction["qty"]))
            cost = abs(Decimal(str(transaction["amt"])))
            price = Decimal(str(transaction["pr"]))
            date = parser.parse(str(transaction["date"]).replace("00:00:00 EDT ", "")).date().isoformat()
            fees = Decimal("0.0035") * quantity
            value = price * quantity

            # Note: This intentionally causes trades on the same day for the same asset have the same ID
            # We handle these cases separately, which are rare since the main user of this product
            # does not place multiple trades for the same asset in the same day
            id_string = f"{asset_info.asset}_{date}_{action}"
            trade_id = f"ibkr-{hashlib.sha256(id_string.encode()).hexdigest()[:20]}"

            trade = models.Trade(
                id=trade_id,
                platform=Platform.IBKR.value,
                date=date,
                action=action,
                asset=asset_info.asset,
                price=price,
                quantity=quantity,
                fees=fees,
                cost=cost,
                value=value,
                excluded=False,
            )

            # See if we have an ID conflict with a trade on the same date with
            # a different quantity or price
            # If we do, we need to generate a new ID; if we don't, we can just leave
            # it as is which will upsert on conflict with the latest value for dupes
            if trade_has_id_conflict(db, trade):
                suffix = f"{quantity}_{price}_{cost}_{value}"
                id_string = f"{id_string}_{suffix}"
                trade.id = f"ibkr-{hashlib.sha256(id_string.encode()).hexdigest()[:20]}"

            trades.append(trade)

    return trades


def get_recent_coinbase_trades(start_date: datetime.date) -> list[models.Trade]:
    """
    Scrapes recent coinbase trades since the last specified date
    :param start_date: First date to query orders from, inclusively
    """
    client = RESTClient(api_key=config.coinbase_api_key, api_secret=config.coinbase_api_secret)

    trades = []
    orders = client.list_orders(order_status=["FILLED"], start_date=f"{start_date.isoformat()}T00:00:00.000000000Z")
    for order in orders["orders"]:
        if order["product_id"] not in [f"{asset}-USD" for asset in config.crypto_tokens]:
            continue

        asset = order["product_id"].replace("-USD", "")
        trade_id = f"coinbase-{order['order_id']}"
        date = str(order["last_fill_time"])[:10]

        trade = models.Trade(
            id=trade_id,
            platform=Platform.COINBASE.value,
            date=date,
            action=str(order["side"]),
            asset=asset,
            price=Decimal(str(order["average_filled_price"])),
            quantity=Decimal(str(order["filled_size"])),
            fees=Decimal(str(order["total_fees"])),
            cost=Decimal(str(order["total_value_after_fees"])),
            value=Decimal(str(order["filled_value"])),
            excluded=False,
        )

        trades.append(trade)

    return trades
