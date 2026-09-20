import pytest

from backend.database import models
from backend.scrapers import robinhood

INDIVIDUAL_ACCOUNT = {
    "id": "acct-individual",
    "name": "Robinhood Individual",
    "brokerage_authorization": "auth-2",
    "account_category": "INVESTMENT",
    "raw_type": "INDIVIDUAL",
}
CRYPTO_ACCOUNT = {
    "id": "acct-crypto",
    "name": "Robinhood Crypto",
    "brokerage_authorization": "auth-2",
    "account_category": "INVESTMENT",
    "raw_type": "DIGITALASSET",
}
ROTH_ACCOUNT = {
    "id": "acct-roth",
    "name": "Robinhood Roth Ira",
    "brokerage_authorization": "auth-2",
    "account_category": "INVESTMENT",
    "raw_type": "ROTH_IRA",
}
CREDIT_CARD_ACCOUNT = {
    "id": "acct-credit-card",
    "name": "Robinhood Credit Card",
    "brokerage_authorization": "auth-2",
    "account_category": "LOC",
    "raw_type": "CREDITCARD",
}


def test_find_connection_returns_robinhood_entry():
    authorizations = [
        {"id": "auth-1", "disabled": False, "brokerage": {"slug": "ALPACA"}},
        {"id": "auth-2", "disabled": False, "brokerage": {"slug": "ROBINHOOD"}},
    ]
    assert robinhood._find_connection(authorizations)["id"] == "auth-2"


def test_find_connection_returns_none_when_not_connected():
    authorizations = [
        {"id": "auth-1", "disabled": False, "brokerage": {"slug": "ALPACA"}}
    ]
    assert robinhood._find_connection(authorizations) is None


def test_find_syncable_accounts_returns_individual_and_roth():
    accounts = [
        INDIVIDUAL_ACCOUNT,
        CRYPTO_ACCOUNT,
        ROTH_ACCOUNT,
        CREDIT_CARD_ACCOUNT,
    ]

    syncable = robinhood._find_syncable_accounts(
        accounts=accounts, connection_id="auth-2"
    )

    assert {(account.account_id, account.trade_account) for account in syncable} == {
        ("acct-individual", models.TradeAccount.BROKERAGE.value),
        ("acct-roth", models.TradeAccount.ROTH.value),
    }


def test_find_syncable_accounts_excludes_crypto_and_credit_card():
    accounts = [
        INDIVIDUAL_ACCOUNT,
        CRYPTO_ACCOUNT,
        ROTH_ACCOUNT,
        CREDIT_CARD_ACCOUNT,
    ]

    syncable = robinhood._find_syncable_accounts(
        accounts=accounts, connection_id="auth-2"
    )

    account_ids = {account.account_id for account in syncable}
    assert "acct-crypto" not in account_ids
    assert "acct-credit-card" not in account_ids


def test_find_syncable_accounts_ignores_accounts_from_other_connections():
    other_connection_account = {
        **INDIVIDUAL_ACCOUNT,
        "brokerage_authorization": "auth-1",
    }

    with pytest.raises(AssertionError):
        robinhood._find_syncable_accounts(
            accounts=[other_connection_account], connection_id="auth-2"
        )


def test_find_syncable_accounts_raises_when_none_are_syncable():
    accounts = [CRYPTO_ACCOUNT, CREDIT_CARD_ACCOUNT]

    with pytest.raises(AssertionError):
        robinhood._find_syncable_accounts(accounts=accounts, connection_id="auth-2")
