import dataclasses
from decimal import Decimal

import pytest

from backend import config
from backend.config import Asset
from tests.conftest import _asset_config


def _asset_with_target(asset: str, target_allocation: Decimal) -> Asset:
    return dataclasses.replace(
        _asset_config(asset), target_allocation=target_allocation
    )


def test_validate_target_allocations_passes_when_sum_is_100() -> None:
    assets = [
        _asset_with_target("VT", Decimal(60)),
        _asset_with_target("VOO", Decimal(40)),
    ]

    config.validate_target_allocations(assets)


def test_validate_target_allocations_raises_when_sum_is_not_100() -> None:
    assets = [
        _asset_with_target("VT", Decimal(60)),
        _asset_with_target("VOO", Decimal(42)),
    ]

    with pytest.raises(ValueError, match="102"):
        config.validate_target_allocations(assets)


def test_checked_in_assets_yaml_loads_without_error() -> None:
    # Exercises the same parsing path the running app uses: Config's after-validator
    # calls validate_target_allocations once assets.yaml has been parsed into Assets,
    # so a startup here proves the checked-in targets still sum to 100.
    real_config = config.Config()

    assert len(real_config.assets) > 0


def test_disabled_sync_platforms_parses_single_value(monkeypatch) -> None:
    monkeypatch.setenv("DISABLED_SYNC_PLATFORMS", "ibkr")

    assert config.Config().disabled_sync_platforms == {"ibkr"}


def test_disabled_sync_platforms_parses_comma_separated_values(monkeypatch) -> None:
    monkeypatch.setenv("DISABLED_SYNC_PLATFORMS", "ibkr,coinbase")

    assert config.Config().disabled_sync_platforms == {"ibkr", "coinbase"}


def test_disabled_sync_platforms_strips_whitespace(monkeypatch) -> None:
    monkeypatch.setenv("DISABLED_SYNC_PLATFORMS", " ibkr , coinbase ")

    assert config.Config().disabled_sync_platforms == {"ibkr", "coinbase"}


def test_disabled_sync_platforms_empty_string_is_empty_set(monkeypatch) -> None:
    # This is the value shipped in .env.template - it must not raise
    monkeypatch.setenv("DISABLED_SYNC_PLATFORMS", "")

    assert config.Config().disabled_sync_platforms == set()


def test_disabled_sync_platforms_unset_is_empty_set(monkeypatch) -> None:
    monkeypatch.delenv("DISABLED_SYNC_PLATFORMS", raising=False)

    assert config.Config().disabled_sync_platforms == set()


def test_disabled_sync_platforms_rejects_unknown_platform(monkeypatch) -> None:
    monkeypatch.setenv("DISABLED_SYNC_PLATFORMS", "ibrk")

    with pytest.raises(ValueError, match="ibrk"):
        config.Config()
