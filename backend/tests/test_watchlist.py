import dataclasses
import datetime
from decimal import Decimal

from backend.config import Asset, VALID_DURATIONS, config
from backend.database import connection, models
from backend.router import transforms
from tests import factories
from tests.conftest import _asset_config


def _watchlist_asset_config(asset: str, target_allocation: str) -> Asset:
    return dataclasses.replace(
        _asset_config(asset), target_allocation=Decimal(target_allocation)
    )


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {config.fastapi_secret}"}


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


# --- GET /watchlist -------------------------------------------------------------------


def test_watchlist_route_returns_assets_in_config_order(client, monkeypatch):
    monkeypatch.setattr(
        config,
        "assets",
        {
            "VT": _watchlist_asset_config("VT", "10"),
            "TIA": _watchlist_asset_config("TIA", "5"),
        },
    )

    # The client fixture overrides `connection.get_db` with a lambda bound to its own
    # in-memory `StaticPool` engine - calling it directly gives a session on that same
    # shared db, so seeded rows are visible to the route.
    db = client.app.dependency_overrides[connection.get_db]()
    db.add(models.LivePrice(asset="VT", price=Decimal("150")))
    db.add(models.LivePrice(asset="TIA", price=Decimal("5")))
    db.commit()

    response = client.get("/watchlist", headers=_auth_headers())

    assert response.status_code == 200
    body = response.json()
    assert [entry["asset"] for entry in body] == ["VT", "TIA"]
    for entry in body:
        assert {
            "asset",
            "description",
            "market",
            "current_price",
            "changes",
            "sparklines",
        } <= set(entry.keys())
        assert set(entry["changes"].keys()) == set(VALID_DURATIONS)
        assert set(entry["sparklines"].keys()) == set(VALID_DURATIONS)
        # Decimals serialise as strings and the live price is always the last point
        assert entry["sparklines"]["1Y"][-1] == entry["current_price"]


def test_watchlist_sparkline_covers_window_and_ends_at_live_price(
    db_session, monkeypatch
):
    monkeypatch.setattr(config, "assets", {"VT": _watchlist_asset_config("VT", "10")})
    today = datetime.date.today()

    db_session.add(models.LivePrice(asset="VT", price=Decimal("150")))
    # Ten daily closes, priced by their age so the window's contents are recognisable
    for days_ago in range(1, 11):
        db_session.add(
            factories.make_historical_price(
                asset="VT",
                date=today - datetime.timedelta(days=days_ago),
                price=Decimal(100 + days_ago),
            )
        )
    db_session.commit()

    watchlist = transforms.get_watchlist(db_session)

    # 1W spans the closes from 7 days ago onward, oldest first, then the live price
    assert watchlist[0].sparklines["1W"] == [
        Decimal(107),
        Decimal(106),
        Decimal(105),
        Decimal(104),
        Decimal(103),
        Decimal(102),
        Decimal(101),
        Decimal(150),
    ]
    # ALL has no window start, so every stored close is included
    assert len(watchlist[0].sparklines["ALL"]) == 11
    assert set(watchlist[0].sparklines.keys()) == set(VALID_DURATIONS)


def test_downsample_caps_points_and_keeps_endpoints():
    values = [Decimal(value) for value in range(400)]

    sampled = transforms._downsample(values=values, points=transforms.SPARKLINE_POINTS)

    assert len(sampled) == transforms.SPARKLINE_POINTS
    assert sampled[0] == Decimal(0)
    assert sampled[-1] == Decimal(399)
    assert sampled == sorted(sampled)


def test_downsample_returns_short_series_unchanged():
    values = [Decimal(value) for value in range(5)]

    assert transforms._downsample(values=values, points=40) == values


def test_watchlist_sparkline_starts_at_reference_close_when_start_date_has_no_row(
    db_session, monkeypatch
):
    monkeypatch.setattr(config, "assets", {"VT": _watchlist_asset_config("VT", "10")})
    today = datetime.date.today()
    one_week_start = today - datetime.timedelta(days=7)

    db_session.add(models.LivePrice(asset="VT", price=Decimal("150")))
    # No close on the start date itself: the last one before it is the reference row
    db_session.add(
        factories.make_historical_price(
            asset="VT",
            date=one_week_start - datetime.timedelta(days=2),
            price=Decimal("90"),
        )
    )
    db_session.add(
        factories.make_historical_price(
            asset="VT",
            date=one_week_start + datetime.timedelta(days=1),
            price=Decimal("95"),
        )
    )
    db_session.commit()

    watchlist = transforms.get_watchlist(db_session)

    assert watchlist[0].sparklines["1W"] == [Decimal(90), Decimal(95), Decimal(150)]
    assert watchlist[0].changes["1W"] == (Decimal(150) - Decimal(90)) / Decimal(90) * 100
