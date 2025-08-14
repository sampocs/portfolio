import datetime
from enum import Enum
import json
from typing import Any
import logging
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
from ibind.oauth.oauth1a import OAuth1aConfig
from dataclasses import dataclass
from functools import cached_property
import yaml
from decimal import Decimal

PROJECT_HOME = Path(__file__).parent.parent.parent
ENV_FILE = ".env"
ASSETS_FILE = "assets.yaml"

VALID_DURATIONS = ["1W", "1M", "YTD", "1Y", "ALL"]
DURATION_TO_TIMEDELTA = {
    "1W": datetime.timedelta(days=7),
    "1M": datetime.timedelta(days=30),
    "1Y": datetime.timedelta(days=365),
}

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("portfolio")


@dataclass
class InvalidPriceResponse(Exception):
    price_type: str
    source: str
    response_data: dict

    @property
    def error_msg(self) -> str:
        return f"Invalid {self.price_type} price response from {self.source}"

    def log_error(self) -> None:
        logger.error(self.error_msg)
        logger.error(json.dumps(self.response_data, indent=4))


class Market(Enum):
    STOCKS = "Stocks"
    CRYPTO_STOCKS = "Crypto"
    ALTERNATIVES = "Alternatives"


class Segment(Enum):
    STOCK_ETFS = "Stock ETFs"
    CRYPTO_STOCKS = "Crypto Stocks"
    CRYPTO_TOKENS = "Crypto Tokens"
    ALTERNATIVES = "Gold"
    REAL_ESTATE = "Real Estate"


class Platform(Enum):
    IBKR = "ibkr"
    COINBASE = "coinbase"


class PriceType(Enum):
    STOCKS = "stocks"
    CRYPTO = "crypto"


@dataclass
class Asset:
    asset: str
    description: str
    target_allocation: Decimal
    market: Market
    segment: Segment
    platform: Platform
    price_type: PriceType

    @classmethod
    def from_dict(cls, data: dict) -> "Asset":
        """Create an Asset instance from a dictionary with validation."""
        return cls(
            asset=data["asset"],
            description=data["description"],
            target_allocation=Decimal(data["target_allocation"]),
            market=Market(data["market"]),
            segment=Segment(data["segment"]),
            platform=Platform(data["platform"]),
            price_type=PriceType(data["price_type"]),
        )


class Config(BaseSettings):
    project_home: Path = Field(default=PROJECT_HOME)
    assets_config: Path = Field(default=PROJECT_HOME / ASSETS_FILE)

    trades_data_dir: Path = Field(default=PROJECT_HOME / "data" / "trades" / "clean")
    prices_data_dir: Path = Field(default=PROJECT_HOME / "data" / "prices" / "clean")

    coinbase_account_id: str = Field(alias="COINBASE_ACCOUNT_ID")
    ibkr_account_id: str = Field(alias="IBKR_ACCOUNT_ID")

    ibind_use_oauth: bool = Field(alias="IBIND_USE_OAUTH", default=False)
    ibind_oauth1a_consumer_key: str = Field(alias="IBIND_OAUTH1A_CONSUMER_KEY", default="")
    ibind_oauth1a_encryption_key_fp: str = Field(alias="IBIND_OAUTH1A_ENCRYPTION_KEY_FP", default="")
    ibind_oauth1a_signature_key_fp: str = Field(alias="IBIND_OAUTH1A_SIGNATURE_KEY_FP", default="")
    ibind_oauth1a_access_token: str = Field(alias="IBIND_OAUTH1A_ACCESS_TOKEN", default="")
    ibind_oauth1a_access_token_secret: str = Field(alias="IBIND_OAUTH1A_ACCESS_TOKEN_SECRET", default="")
    ibind_oauth1a_dh_prime: str = Field(alias="IBIND_OAUTH1A_DH_PRIME", default="")
    ibeam_port: str = Field(alias="IBEAM_PORT", default="5000")

    coinbase_api_key: str = Field(alias="COINBASE_API_KEY")
    coinbase_api_secret: str = Field(alias="COINBASE_API_SECRET")

    postgres_url: str = Field(alias="POSTGRES_URL")
    fastapi_secret: str = Field(alias="FASTAPI_SECRET")

    finhub_api_token: str = Field(alias="FINHUB_API_TOKEN")
    alpha_vantage_api_token: str = Field(alias="ALPHA_VANTAGE_API_TOKEN")

    finhub_live_price_api: str = Field(default="https://finnhub.io/api/v1/quote")
    coingecko_live_price_api: str = Field(default="https://api.coingecko.com/api/v3/simple/price")
    alpha_prev_close_api: str = Field(default="https://www.alphavantage.co/query")
    coingecko_prev_close_api: str = Field(default="https://api.coingecko.com/api/v3/coins/{}/market_chart")

    price_cache_ttl_min: int = Field(default=5)

    model_config = SettingsConfigDict(case_sensitive=True, env_file=PROJECT_HOME / ".env", extra="allow")

    @model_validator(mode="after")
    def validate_ibind_config(self) -> "Config":
        """Validate OAuth configuration when OAuth is enabled"""
        if self.ibind_use_oauth:
            oauth_fields = {
                "ibind_oauth1a_consumer_key": "IBIND_OAUTH1A_CONSUMER_KEY",
                "ibind_oauth1a_encryption_key_fp": "IBIND_OAUTH1A_ENCRYPTION_KEY_FP",
                "ibind_oauth1a_signature_key_fp": "IBIND_OAUTH1A_SIGNATURE_KEY_FP",
                "ibind_oauth1a_access_token": "IBIND_OAUTH1A_ACCESS_TOKEN",
                "ibind_oauth1a_access_token_secret": "IBIND_OAUTH1A_ACCESS_TOKEN_SECRET",
                "ibind_oauth1a_dh_prime": "IBIND_OAUTH1A_DH_PRIME",
            }

            missing_fields = [
                env_name for field_name, env_name in oauth_fields.items() if not getattr(self, field_name)
            ]

            if missing_fields:
                raise ValueError(
                    f"OAuth is enabled but missing required environment variables: {', '.join(missing_fields)}"
                )

        return self

    @model_validator(mode="after")
    def load_assets(self) -> "Config":
        """Access assets to trigger yaml read and error early if not configured properly"""
        _ = self.assets
        return self

    @property
    def ibind_oauth_config(self) -> OAuth1aConfig:
        """Get OAuth configuration. Should only be called when OAuth is enabled"""
        if not self.ibind_use_oauth:
            raise RuntimeError("OAuth is not enabled. Check ibind_use_oauth setting.")

        return OAuth1aConfig(
            consumer_key=self.ibind_oauth1a_consumer_key,
            encryption_key_fp=str(PROJECT_HOME / self.ibind_oauth1a_encryption_key_fp),
            signature_key_fp=str(PROJECT_HOME / self.ibind_oauth1a_signature_key_fp),
            access_token=self.ibind_oauth1a_access_token,
            access_token_secret=self.ibind_oauth1a_access_token_secret,
            dh_prime=self.ibind_oauth1a_dh_prime,
        )

    @property
    def ibind_client_params(self) -> dict[str, Any]:
        if self.ibind_use_oauth:
            return {"use_oauth": True, "oauth_config": self.ibind_oauth_config}
        return {"port": self.ibeam_port}

    @cached_property
    def assets(self) -> dict[str, Asset]:
        """Load and parse assets YAML"""
        with open(self.assets_config, "r") as f:
            asset_data = yaml.safe_load(f)

        return {asset["asset"]: Asset.from_dict(asset) for asset in asset_data["assets"]}

    @property
    def stock_tickers(self) -> list[str]:
        """Returns a list of all stock tickers"""
        return [asset_id for asset_id, asset_info in self.assets.items() if asset_info.price_type == PriceType.STOCKS]

    @property
    def crypto_tokens(self) -> list[str]:
        """Returns a list of all crypto tokens"""
        return [asset_id for asset_id, asset_info in self.assets.items() if asset_info.price_type == PriceType.CRYPTO]

    @property
    def coingecko_ids(self) -> dict[str, str]:
        """Returns a mapping of each crypto token to it's coingecko ID"""
        return {
            asset_id: asset_info.description.lower()
            for asset_id, asset_info in self.assets.items()
            if asset_info.price_type == PriceType.CRYPTO
        }


config = Config()  # type: ignore
