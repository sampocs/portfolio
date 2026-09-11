import datetime
import json
from typing import Any

import click
from snaptrade_client import SnapTrade, SnapTradeAuth

from backend.config import config, logger

BROKERAGE_SLUG = "ROBINHOOD"
CONNECTION_TYPE_READ_ONLY = "read"
TRADE_ACTIVITY_TYPES = "BUY,SELL,REI"
INVESTMENT_ACCOUNT_CATEGORY = "INVESTMENT"
ACTIVITY_PAGE_SIZE = 1000
MAX_ACTIVITY_PAGES = 100


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


def get_account_id(client: SnapTrade, connection_id: str) -> str:
    """Returns the ID of the Robinhood account under the given connection"""
    response = client.account_information.list_user_accounts()
    return _find_account_id(
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


def _find_account_id(accounts: list[dict], connection_id: str) -> str:
    """
    Returns the ID of the brokerage account under the given connection

    A robinhood connection can also expose non-brokerage accounts (e.g. spending), which
    the account category tells apart. Brokerages that don't report a category fall back
    to requiring a single account, where an ambiguous result is raised rather than guessed at
    """
    connection_accounts = [
        account
        for account in accounts
        if account["brokerage_authorization"] == connection_id
    ]

    investment_accounts = [
        account
        for account in connection_accounts
        if account.get("account_category") == INVESTMENT_ACCOUNT_CATEGORY
    ]
    if len(investment_accounts) == 1:
        return investment_accounts[0]["id"]

    account_ids = [account["id"] for account in connection_accounts]
    assert len(account_ids) == 1, (
        f"Expected one robinhood account, found {len(account_ids)}: {account_ids}"
    )
    return account_ids[0]


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
