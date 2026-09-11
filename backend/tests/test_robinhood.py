import pytest

from backend.scrapers import robinhood


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


def test_find_account_id_matches_the_connection():
    accounts = [
        {"id": "account-1", "brokerage_authorization": "auth-1"},
        {"id": "account-2", "brokerage_authorization": "auth-2"},
    ]
    assert (
        robinhood._find_account_id(accounts=accounts, connection_id="auth-2")
        == "account-2"
    )


def test_find_account_id_rejects_ambiguous_accounts():
    accounts = [
        {"id": "account-1", "brokerage_authorization": "auth-2"},
        {"id": "account-2", "brokerage_authorization": "auth-2"},
    ]
    with pytest.raises(AssertionError):
        robinhood._find_account_id(accounts=accounts, connection_id="auth-2")
