import dataclasses
import datetime
from decimal import Decimal

from backend.config import Asset, config
from backend.database import models
from backend.router import transforms
from tests import factories
from tests.conftest import _asset_config


def _watchlist_asset_config(asset: str, target_allocation: str) -> Asset:
    return dataclasses.replace(
        _asset_config(asset), target_allocation=Decimal(target_allocation)
    )


def test_watchlist_omits_asset_with_zero_target_allocation(db_session, monkeypatch):
    monkeypatch.setattr(
        config,
        "assets",
        {
            "VT": _watchlist_asset_config("VT", "10"),
            "TIA": _watchlist_asset_config("TIA", "0"),
        },
    )
    db_session.add(models.LivePrice(asset="VT", price=Decimal("150")))
    db_session.add(models.LivePrice(asset="TIA", price=Decimal("5")))
    db_session.commit()

    watchlist = transforms.get_watchlist(db_session)

    assert [entry.asset for entry in watchlist] == ["VT"]


def test_watchlist_percent_math_for_1y_against_seeded_close(db_session, monkeypatch):
    monkeypatch.setattr(config, "assets", {"VT": _watchlist_asset_config("VT", "10")})
    today = datetime.date.today()
    one_year_start = today - datetime.timedelta(days=365)

    db_session.add(models.LivePrice(asset="VT", price=Decimal("150")))
    db_session.add(
        factories.make_historical_price(
            asset="VT", date=one_year_start, price=Decimal("100")
        )
    )
    # A later close shouldn't be picked as the 1Y reference
    db_session.add(
        factories.make_historical_price(
            asset="VT", date=today - datetime.timedelta(days=1), price=Decimal("999")
        )
    )
    db_session.commit()

    watchlist = transforms.get_watchlist(db_session)

    # (150 - 100) / 100 * 100
    assert watchlist[0].changes["1Y"] == Decimal("50")


def test_watchlist_all_uses_earliest_close(db_session, monkeypatch):
    monkeypatch.setattr(config, "assets", {"VT": _watchlist_asset_config("VT", "10")})

    db_session.add(models.LivePrice(asset="VT", price=Decimal("200")))
    db_session.add(
        factories.make_historical_price(
            asset="VT", date=datetime.date(2020, 1, 1), price=Decimal("80")
        )
    )
    db_session.add(
        factories.make_historical_price(
            asset="VT", date=datetime.date(2024, 1, 1), price=Decimal("120")
        )
    )
    db_session.commit()

    watchlist = transforms.get_watchlist(db_session)

    # (200 - 80) / 80 * 100, using the earliest (2020) close, not the 2024 one
    assert watchlist[0].changes["ALL"] == Decimal("150")


def test_watchlist_missing_reference_yields_zero(db_session, monkeypatch):
    monkeypatch.setattr(config, "assets", {"VT": _watchlist_asset_config("VT", "10")})
    db_session.add(models.LivePrice(asset="VT", price=Decimal("150")))
    db_session.commit()

    watchlist = transforms.get_watchlist(db_session)

    assert all(pct == Decimal("0") for pct in watchlist[0].changes.values())


def test_watchlist_zero_reference_yields_zero(db_session, monkeypatch):
    monkeypatch.setattr(config, "assets", {"VT": _watchlist_asset_config("VT", "10")})
    today = datetime.date.today()

    db_session.add(models.LivePrice(asset="VT", price=Decimal("150")))
    db_session.add(
        factories.make_historical_price(
            asset="VT", date=today - datetime.timedelta(days=365), price=Decimal("0")
        )
    )
    db_session.commit()

    watchlist = transforms.get_watchlist(db_session)

    assert watchlist[0].changes["1Y"] == Decimal("0")
