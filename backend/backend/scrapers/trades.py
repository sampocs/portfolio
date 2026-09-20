import datetime
import hashlib
import zoneinfo
from decimal import Decimal

from ibind import IbkrClient
from backend.config import config, Platform, logger
from backend.database import models, crud
from backend.scrapers import robinhood
from coinbase.rest import RESTClient
from sqlalchemy.orm import Session

# Extended-hours fills land on the next UTC day, so timestamps are read in market time
MARKET_TIMEZONE = zoneinfo.ZoneInfo("America/New_York")

# SnapTrade's activity types are open ended (splits, transfers, option exercises), and
# only the server-side filter keeps those out, so anything else is treated as unknown
ACCEPTED_ACTIVITY_TYPES = {"BUY", "SELL", "REI"}

# IBKR transactions don't carry a commission field, so fees are estimated per share
IBKR_FEE_PER_SHARE = Decimal("0.0035")


def resolve_ibkr_trade_id(db: Session, new_trade: models.Trade) -> str | None:
    """
    IBKR transactions carry no stable ID, so a trade's ID is a hash of its asset, date,
    and action, and the sync re-fetches from the last trade date every run. The same
    fill therefore comes back on later runs, sometimes with values that drift slightly
    as the order settles, and it must upsert onto its existing row rather than insert
    a second one.

    Only IBKR rows are candidates: a same-day trade recorded by hand for another
    platform (a Vanguard sale, say) shares the asset/date bucket but can never share an
    ID with an IBKR fill. If an existing IBKR row for the same action matches within
    tolerance, its ID is reused, or None if that row was excluded by hand, since
    re-inserting it would undo the exclusion. Otherwise a genuinely distinct second
    fill on the same day gets a value-suffixed ID so it doesn't overwrite the first.
    """
    same_day_fills = [
        existing
        for existing in crud.get_trades(
            db, asset=new_trade.asset, date=new_trade.date, include_excluded=True
        )
        if existing.platform == Platform.IBKR.value
        and existing.action == new_trade.action
    ]

    for existing in same_day_fills:
        if _is_same_fill(existing=existing, candidate=new_trade):
            return None if existing.excluded else existing.id

    base_id = _ibkr_trade_id(f"{new_trade.asset}_{new_trade.date}_{new_trade.action}")
    if any(existing.id == base_id for existing in same_day_fills):
        suffix = f"{new_trade.quantity}_{new_trade.price}_{new_trade.cost}_{new_trade.value}"
        return _ibkr_trade_id(
            f"{new_trade.asset}_{new_trade.date}_{new_trade.action}_{suffix}"
        )

    return base_id


def _is_same_fill(existing: models.Trade, candidate: models.Trade) -> bool:
    """Whether two same-day trades are the same fill, allowing for settlement drift"""
    if existing.quantity == 0 or existing.price == 0:
        return False

    tolerance = Decimal("0.0001")
    qty_diff_pct = abs(existing.quantity - candidate.quantity) / abs(existing.quantity)
    price_diff_pct = abs(existing.price - candidate.price) / existing.price
    return qty_diff_pct <= tolerance and price_diff_pct <= tolerance


def get_recent_ibkr_trades(
    db: Session, start_date: datetime.date
) -> list[models.Trade]:
    """
    Scrapes recent IBKR trades
    :param start_date: First date to query orders from, inclusively
    """
    client = IbkrClient(**config.ibind_client_params)
    client.tickle()

    trades = []
    for asset_info in config.assets.values():
        if asset_info.platform != Platform.IBKR:
            continue

        contract_id = asset_info.contract_id
        assert contract_id, f"Contract ID not provided for {asset_info.asset}"

        current_date = datetime.date.today()
        days = (current_date - start_date).days + 1

        transactions_raw = client.transaction_history(
            config.ibkr_account_id,
            contract_id,
            "USD",
            days,  # type: ignore
        )
        if not transactions_raw.data or "transactions" not in transactions_raw.data:
            continue
        transactions: list[dict[str, str | int]] = transactions_raw.data["transactions"]  # type: ignore

        for transaction in transactions:
            if transaction["type"] not in ["Buy", "Sell"]:
                continue

            trade = _build_ibkr_trade(transaction, asset=asset_info.asset)

            # Re-fetched fills upsert onto their existing row; only a distinct
            # same-day fill gets a fresh ID, and an excluded fill is left alone
            trade_id = resolve_ibkr_trade_id(db, new_trade=trade)
            if trade_id is None:
                continue

            trade.id = trade_id
            trades.append(trade)

    return trades


def _build_ibkr_trade(transaction: dict, asset: str) -> models.Trade:
    """
    Converts an IBKR transaction into a trade

    IBKR reports a sell's quantity as negative, but the action already carries the
    direction, so the quantity is normalized to positive like every other platform.
    The lot matcher relies on this - it rejects sells with a non-positive quantity
    """
    action = str(transaction["type"]).upper()
    quantity = abs(Decimal(str(transaction["qty"])))
    cost = abs(Decimal(str(transaction["amt"])))
    price = Decimal(str(transaction["pr"]))
    date = datetime.datetime.strptime(str(transaction["rawDate"]), "%Y%m%d").strftime(
        "%Y-%m-%d"
    )

    # Note: This intentionally causes trades on the same day for the same asset have the same ID
    # We handle these cases separately, which are rare since the main user of this product
    # does not place multiple trades for the same asset in the same day
    return models.Trade(
        id=_ibkr_trade_id(f"{asset}_{date}_{action}"),
        platform=Platform.IBKR.value,
        date=date,
        action=action,
        asset=asset,
        price=price,
        quantity=quantity,
        fees=IBKR_FEE_PER_SHARE * quantity,
        cost=cost,
        value=price * quantity,
        excluded=False,
        account=models.TradeAccount.BROKERAGE.value,
    )


def _ibkr_trade_id(id_string: str) -> str:
    return f"ibkr-{hashlib.sha256(id_string.encode()).hexdigest()[:20]}"


def get_recent_coinbase_trades(start_date: datetime.date) -> list[models.Trade]:
    """
    Scrapes recent coinbase trades since the last specified date
    :param start_date: First date to query orders from, inclusively
    """
    client = RESTClient(
        api_key=config.coinbase_api_key, api_secret=config.coinbase_api_secret
    )

    trades = []
    orders = client.list_orders(
        order_status=["FILLED"],
        start_date=f"{start_date.isoformat()}T00:00:00.000000000Z",
    )
    for order in orders["orders"]:
        if order["product_id"] not in [
            f"{asset}-USD" for asset in config.crypto_tokens
        ]:
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
            account=models.TradeAccount.BROKERAGE.value,
        )

        trades.append(trade)

    return trades


def get_recent_robinhood_trades(start_date: datetime.date | None) -> list[models.Trade]:
    """
    Scrapes recent robinhood trades through SnapTrade
    :param start_date: First date to query transactions from, inclusively.
                       None pulls the account's full history
    """
    if not config.snaptrade_configured:
        logger.info("SnapTrade is not configured, skipping robinhood trades")
        return []

    client = robinhood.get_client()
    connection = robinhood.get_connection(client)
    if not connection:
        logger.info("Robinhood is not connected, skipping robinhood trades")
        return []

    # A disabled connection keeps returning stale cached data instead of failing,
    # so this flag is the only signal that it needs to be re-authorized
    if connection.get("disabled"):
        raise robinhood.RobinhoodDisconnectedError()

    account_id = robinhood.get_account_id(client=client, connection_id=connection["id"])
    activities = robinhood.get_activities(
        client=client, account_id=account_id, start_date=start_date
    )

    # Each activity is converted on its own so a single unusable one costs one trade
    # instead of the batch - the next sync re-fetches the same range and would keep
    # failing on it forever
    robinhood_trades = []
    for activity in activities:
        if not _is_tracked_activity(activity):
            continue

        trade = _build_robinhood_trade(activity)
        if trade:
            robinhood_trades.append(trade)

    return robinhood_trades


def _is_tracked_activity(activity: dict) -> bool:
    """Returns whether the transaction is for an asset in the portfolio config"""
    ticker = _get_ticker(activity)
    if ticker and ticker in config.assets:
        return True

    # A null symbol means there's no equity to check against the config - it's likely
    # an options activity (contract lives in option_symbol instead) or a cash transaction
    if not ticker:
        logger.warning(
            "Skipping robinhood transaction with no equity symbol (likely an option "
            f"or cash transaction): type={activity.get('type')} id={activity.get('id')}"
        )
    else:
        logger.warning(f"Skipping robinhood transaction for untracked asset: {ticker}")

    return False


def _build_robinhood_trade(activity: dict) -> models.Trade | None:
    """
    Converts a SnapTrade transaction into a trade, or None if it can't be trusted

    Every field on a SnapTrade activity is optional in its schema, so a malformed or
    unrecognized one is skipped with a warning rather than raised - the alternative is
    a sync that never gets past it
    """
    activity_id = activity.get("id")
    activity_type = activity.get("type")
    if activity_type not in ACCEPTED_ACTIVITY_TYPES:
        logger.warning(
            f"Skipping robinhood transaction {activity_id} with unexpected type: {activity_type}"
        )
        return None

    trade_date = activity.get("trade_date")
    raw_price = activity.get("price")
    raw_units = activity.get("units")
    ticker = _get_ticker(activity)
    if (
        not activity_id
        or not trade_date
        or raw_price is None
        or raw_units is None
        or not ticker
    ):
        logger.warning(
            f"Skipping robinhood transaction {activity_id} with missing fields: {activity}"
        )
        return None

    # A buy moves shares in and a sell moves them out, so a sign that disagrees with the
    # type means the activity isn't what it claims, and taking abs() would inflate the position
    units = Decimal(str(raw_units))
    is_sell = activity_type == models.TradeAction.SELL.value
    has_expected_sign = units < 0 if is_sell else units > 0
    if not has_expected_sign:
        logger.warning(
            f"Skipping robinhood transaction {activity_id}: {activity_type} with units {units}"
        )
        return None

    action = models.TradeAction.SELL if is_sell else models.TradeAction.BUY
    price = Decimal(str(raw_price))
    quantity = abs(units)
    fees = Decimal(str(activity.get("fee") or 0))
    value = price * quantity

    # Dividend reinvestments don't always carry a cash amount, in which case the cash
    # moved is the trade value plus the fees on a buy, or minus the fees on a sell
    amount = activity.get("amount")
    fee_direction = -1 if is_sell else 1
    cost = (
        abs(Decimal(str(amount)))
        if amount is not None
        else value + fee_direction * fees
    )

    return models.Trade(
        id=f"robinhood-{activity_id}",
        platform=Platform.ROBINHOOD.value,
        date=_get_market_date(trade_date),
        action=action.value,
        asset=ticker,
        price=price,
        quantity=quantity,
        fees=fees,
        cost=cost,
        value=value,
        excluded=False,
        account=models.TradeAccount.BROKERAGE.value,
    )


def _get_ticker(activity: dict) -> str | None:
    """Returns the activity's ticker, which is absent on non-security transactions"""
    symbol = activity.get("symbol")
    if not symbol:
        return None

    return symbol.get("symbol")


def _get_market_date(trade_date: str) -> str:
    """
    Returns the date a transaction should be attributed to

    SnapTrade timestamps are UTC, where an evening fill rolls into the next day,
    so a timestamp carrying a UTC offset is converted to market time first;
    a value with no offset is taken as-is
    """
    parsed_date = datetime.datetime.fromisoformat(trade_date.replace("Z", "+00:00"))
    if parsed_date.tzinfo is None:
        return parsed_date.date().isoformat()

    return parsed_date.astimezone(MARKET_TIMEZONE).date().isoformat()
