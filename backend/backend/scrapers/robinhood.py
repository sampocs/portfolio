import datetime
import json
from dataclasses import dataclass
from typing import Any

import click
from snaptrade_client import SnapTrade, SnapTradeAuth

from backend.config import config, logger
from backend.database import models

BROKERAGE_SLUG = "ROBINHOOD"
CONNECTION_TYPE_READ_ONLY = "read"
TRADE_ACTIVITY_TYPES = "BUY,SELL,REI"
INVESTMENT_ACCOUNT_CATEGORY = "INVESTMENT"
ACTIVITY_PAGE_SIZE = 1000
MAX_ACTIVITY_PAGES = 100

# Only these raw account types are synced into trades - crypto comes through Coinbase
# instead (Robinhood crypto has a separate API), and non-investment accounts like a
# credit card have no trades to sync at all
RAW_TYPE_TO_TRADE_ACCOUNT = {
    "INDIVIDUAL": models.TradeAccount.BROKERAGE.value,
    "ROTH_IRA": models.TradeAccount.ROTH.value,
}


@dataclass
class RobinhoodAccount:
    """A SnapTrade account to sync, tagged with the ledger account its trades belong to"""

    account_id: str
    trade_account: str


class RobinhoodDisconnectedError(Exception):
    """Raised when the SnapTrade connection to Robinhood has to be re-authorized"""


def get_client() -> SnapTrade:
    """Builds a SnapTrade client from the personal API key, which represents the account owner directly"""
    assert config.snaptrade_configured, "SnapTrade API key is not configured"

    return SnapTrade(
        auth=SnapTradeAuth.personal_api_key(
            client_id=config.snaptrade_client_id,
            consumer_key=config.snaptrade_consumer_key,
        )
    )


def get_connection(client: SnapTrade) -> dict | None:
    """Returns the Robinhood connection, or None if Robinhood has never been connected"""
    response = client.connections.list_brokerage_authorizations()
    return _find_connection(_response_json(response))


def get_syncable_accounts(
    client: SnapTrade, connection_id: str
) -> list[RobinhoodAccount]:
    """Returns every account under the given connection whose trades should be synced"""
    response = client.account_information.list_user_accounts()
    return _find_syncable_accounts(
        accounts=_response_json(response), connection_id=connection_id
    )


def get_activities(
    client: SnapTrade, account_id: str, start_date: datetime.date | None
) -> list[dict]:
    """
    Returns the buy, sell and dividend-reinvestment transactions since the start date
    :param start_date: First date to query transactions from, inclusively.
                       None pulls the account's full history
    """
    activities = []
    offset = 0

    for page_num in range(MAX_ACTIVITY_PAGES):
        response = client.account_information.get_account_activities(
            account_id=account_id,
            start_date=start_date,
            type=TRADE_ACTIVITY_TYPES,
            offset=offset,
            limit=ACTIVITY_PAGE_SIZE,
        )
        page = _response_json(response).get("data", [])
        activities += page

        # A short page means there's nothing left to fetch
        if len(page) < ACTIVITY_PAGE_SIZE:
            return activities

        offset += ACTIVITY_PAGE_SIZE

    raise RuntimeError(
        f"Exceeded {MAX_ACTIVITY_PAGES} pages fetching activities for "
        f"account {account_id} (page {page_num + 1}); offset may not be honored"
    )


def get_connection_portal_url() -> str:
    """
    Returns a SnapTrade Connection Portal URL used to link or repair the Robinhood connection
    The URL expires after 5 minutes
    """
    client = get_client()
    connection = get_connection(client)

    # Reconnect mode repairs the existing connection - without it, a second
    # connection would be created alongside the broken one
    reconnect_params = {"reconnect": connection["id"]} if connection else {}
    response = client.authentication.login_snap_trade_user(
        broker=BROKERAGE_SLUG,
        connection_type=CONNECTION_TYPE_READ_ONLY,
        **reconnect_params,
    )

    return _response_json(response)["redirectURI"]


def _response_json(response: Any) -> Any:
    """
    Returns the raw JSON payload of a SnapTrade response

    The SDK's `body` is a generated schema object, so reading the underlying
    payload keeps the rest of the codebase working with plain dicts
    """
    return json.loads(response.response.data)


def _find_connection(authorizations: list[dict]) -> dict | None:
    """Returns the Robinhood entry out of all the account's brokerage connections"""
    robinhood_authorizations = [
        authorization
        for authorization in authorizations
        if authorization["brokerage"]["slug"].upper() == BROKERAGE_SLUG
    ]
    if not robinhood_authorizations:
        return None

    assert len(robinhood_authorizations) == 1, (
        f"Expected one robinhood connection, found {len(robinhood_authorizations)}"
    )
    return robinhood_authorizations[0]


def _find_syncable_accounts(
    accounts: list[dict], connection_id: str
) -> list[RobinhoodAccount]:
    """
    Returns the accounts under the given connection whose trades should be synced

    A robinhood connection exposes more than the taxable brokerage account: a crypto
    account (synced separately, via Coinbase, since Robinhood crypto has its own API),
    a Roth IRA, and non-investment accounts like a credit card (an LOC, not INVESTMENT).
    Each investment account's raw_type is mapped to the ledger account its trades belong
    to; anything that doesn't map is skipped rather than guessed at. A connection that
    yields no syncable account would otherwise mean the portfolio quietly goes stale, so
    that case raises instead of returning an empty list.
    """
    connection_accounts = [
        account
        for account in accounts
        if account["brokerage_authorization"] == connection_id
    ]

    syncable_accounts = []
    for account in connection_accounts:
        name = account.get("name")
        raw_type = account.get("raw_type")

        if account.get("account_category") != INVESTMENT_ACCOUNT_CATEGORY:
            logger.info(
                f"Skipping robinhood account (not an investment account): name={name} raw_type={raw_type}"
            )
            continue

        trade_account = RAW_TYPE_TO_TRADE_ACCOUNT.get(raw_type)
        if trade_account is None:
            logger.info(
                f"Skipping robinhood account (unmapped raw_type): name={name} raw_type={raw_type}"
            )
            continue

        syncable_accounts.append(
            RobinhoodAccount(account_id=account["id"], trade_account=trade_account)
        )

    seen_accounts = [
        f"{account.get('name')} ({account.get('raw_type')})"
        for account in connection_accounts
    ]
    assert syncable_accounts, (
        f"No syncable robinhood account found among: {seen_accounts}"
    )
    return syncable_accounts


@click.command()
@click.option(
    "--connect",
    is_flag=True,
    help="Print a Connection Portal URL to link or repair Robinhood",
)
def main(connect: bool):
    assert connect, "Only permitted option is --connect"
    logger.info("Portal URL expires in 5 minutes")
    print(get_connection_portal_url())


if __name__ == "__main__":
    main()
