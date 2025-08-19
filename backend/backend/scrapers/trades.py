import hashlib
import datetime
from decimal import Decimal
from ibind import IbkrClient
from dateutil import parser
from backend.config import config, Platform
from backend.database import models
from coinbase.rest import RESTClient


def get_recent_ibkr_trades(start_date: str) -> list[models.Trade]:
    """
    Scrapes recent IBKR trades
    :param start_date: First date to query orders from, inclusively, in isoformat
    """
    client = IbkrClient(**config.ibind_client_params)

    trades = []
    for asset_info in config.assets.values():
        if asset_info.platform != Platform.IBKR:
            continue

        contract_id = asset_info.contract_id
        assert contract_id, f"Contract ID not provided for {asset_info.asset}"

        current_date = datetime.date.today()
        days = (current_date - datetime.date.fromisoformat(start_date)).days + 1

        transactions_raw = client.transaction_history(config.ibkr_account_id, contract_id, "USD", days)  # type: ignore
        assert transactions_raw.data and transactions_raw.data["transactions"]  # type: ignore
        transactions: list[dict[str, str | int]] = transactions_raw.data["transactions"]  # type: ignore

        for transaction in transactions:
            if transaction["type"] not in ["Buy", "Sell"]:
                continue

            action = str(transaction["type"]).upper()
            quantity = Decimal(str(transaction["qty"]))
            cost = Decimal(str(transaction["amt"]))
            price = Decimal(str(transaction["pr"]))
            date = parser.parse(str(transaction["date"]).replace("00:00:00 EDT ", "")).date().isoformat()
            fees = Decimal("0.0035") * quantity

            id_string = f"{asset_info.asset}_{date}_{action}_{quantity}_{price}_{cost}"
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
                value=price * quantity,
                excluded=False,
            )

            trades.append(trade)

    return trades


def get_recent_coinbase_trades(start_date: str) -> list[models.Trade]:
    """
    Scrapes recent coinbase trades since the last specified date
    :param start_date: First date to query orders from, inclusively, in isoformat
    """
    client = RESTClient(api_key=config.coinbase_api_key, api_secret=config.coinbase_api_secret)

    trades = []
    orders = client.list_orders(order_status=["FILLED"], start_date=start_date)
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
