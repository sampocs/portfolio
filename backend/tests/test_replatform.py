import datetime
from decimal import Decimal

import pytest

from backend.bootstrap import replatform
from backend.database import models
from tests import factories


def _seed(db, *trades: models.Trade) -> None:
    db.add_all(trades)
    db.commit()


def test_dry_run_mutates_nothing(db_session):
    _seed(
        db_session,
        factories.make_trade(
            id="t-1", platform="vanguard", custodian="vanguard", account="roth"
        ),
    )

    result = replatform.run_replatform(
        db_session,
        from_platform="vanguard",
        to_platform="robinhood",
        account="roth",
        asset=None,
        execute=False,
    )

    assert result.executed is False
    assert [trade.id for trade in result.matched_trades] == ["t-1"]
    stored = db_session.get(models.Trade, "t-1")
    assert stored.custodian == "vanguard"


def test_execute_moves_every_row_in_the_group_including_sells(db_session):
    _seed(
        db_session,
        factories.make_trade(
            id="t-1",
            platform="vanguard",
            custodian="vanguard",
            account="roth",
            action=models.TradeAction.BUY.value,
            asset="VT",
        ),
        factories.make_trade(
            id="t-2",
            platform="vanguard",
            custodian="vanguard",
            account="roth",
            action=models.TradeAction.SELL.value,
            asset="VT",
            date=datetime.date(2026, 1, 2),
            quantity=Decimal("4"),
        ),
        # A different account at the same source custodian must be left alone
        factories.make_trade(
            id="t-3",
            platform="vanguard",
            custodian="vanguard",
            account="brokerage",
            asset="VT",
        ),
    )

    result = replatform.run_replatform(
        db_session,
        from_platform="vanguard",
        to_platform="robinhood",
        account="roth",
        asset=None,
        execute=True,
    )

    assert result.executed is True
    assert {trade.id for trade in result.matched_trades} == {"t-1", "t-2"}
    assert db_session.get(models.Trade, "t-1").custodian == "robinhood"
    assert db_session.get(models.Trade, "t-2").custodian == "robinhood"
    # Untouched: different account at the same source custodian
    assert db_session.get(models.Trade, "t-3").custodian == "vanguard"
    # `platform` (where a trade was originally executed) must never move, only `custodian`
    assert db_session.get(models.Trade, "t-1").platform == "vanguard"
    assert db_session.get(models.Trade, "t-2").platform == "vanguard"
    assert db_session.get(models.Trade, "t-3").platform == "vanguard"


def test_asset_filter_narrows_the_move(db_session):
    _seed(
        db_session,
        factories.make_trade(
            id="t-1",
            platform="vanguard",
            custodian="vanguard",
            account="roth",
            asset="VT",
        ),
        factories.make_trade(
            id="t-2",
            platform="vanguard",
            custodian="vanguard",
            account="roth",
            asset="VXUS",
        ),
    )

    result = replatform.run_replatform(
        db_session,
        from_platform="vanguard",
        to_platform="robinhood",
        account="roth",
        asset="VT",
        execute=True,
    )

    assert [trade.id for trade in result.matched_trades] == ["t-1"]
    assert db_session.get(models.Trade, "t-1").custodian == "robinhood"
    # The other asset in the same custodian/account is left untouched
    assert db_session.get(models.Trade, "t-2").custodian == "vanguard"


def test_unknown_source_platform_is_refused(db_session):
    with pytest.raises(ValueError, match="Unknown source platform 'fidelity'"):
        replatform.run_replatform(
            db_session,
            from_platform="fidelity",
            to_platform="robinhood",
            account="roth",
            asset=None,
            execute=True,
        )


def test_unknown_destination_platform_is_refused(db_session):
    with pytest.raises(ValueError, match="Unknown destination platform 'fidelity'"):
        replatform.run_replatform(
            db_session,
            from_platform="vanguard",
            to_platform="fidelity",
            account="roth",
            asset=None,
            execute=True,
        )


def test_unknown_platform_error_lists_valid_values(db_session):
    with pytest.raises(ValueError, match="vanguard"):
        replatform.run_replatform(
            db_session,
            from_platform="fidelity",
            to_platform="robinhood",
            account="roth",
            asset=None,
            execute=True,
        )


def test_unknown_account_is_refused(db_session):
    with pytest.raises(ValueError, match="Unknown account 'ira'"):
        replatform.run_replatform(
            db_session,
            from_platform="vanguard",
            to_platform="robinhood",
            account="ira",
            asset=None,
            execute=True,
        )


def test_unknown_account_error_lists_valid_values(db_session):
    with pytest.raises(ValueError, match="brokerage"):
        replatform.run_replatform(
            db_session,
            from_platform="vanguard",
            to_platform="robinhood",
            account="ira",
            asset=None,
            execute=True,
        )


def test_empty_match_is_a_no_op(db_session):
    _seed(
        db_session,
        factories.make_trade(
            id="t-1", platform="ibkr", custodian="ibkr", account="brokerage"
        ),
    )

    result = replatform.run_replatform(
        db_session,
        from_platform="vanguard",
        to_platform="robinhood",
        account="roth",
        asset=None,
        execute=True,
    )

    assert result.executed is False
    assert result.matched_trades == []
    # The unrelated existing trade is untouched
    assert db_session.get(models.Trade, "t-1").custodian == "ibkr"


def test_merging_into_an_occupied_custodian_is_allowed(db_session):
    _seed(
        db_session,
        factories.make_trade(
            id="t-1",
            platform="robinhood",
            custodian="robinhood",
            account="roth",
            asset="VT",
        ),
        factories.make_trade(
            id="t-2",
            platform="vanguard",
            custodian="vanguard",
            account="roth",
            asset="VT",
        ),
    )

    result = replatform.run_replatform(
        db_session,
        from_platform="vanguard",
        to_platform="robinhood",
        account="roth",
        asset=None,
        execute=True,
    )

    assert [trade.id for trade in result.matched_trades] == ["t-2"]
    assert db_session.get(models.Trade, "t-1").custodian == "robinhood"
    assert db_session.get(models.Trade, "t-2").custodian == "robinhood"
