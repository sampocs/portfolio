from typing import Any
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
from ibind.oauth.oauth1a import OAuth1aConfig

PROJECT_HOME = Path(__file__).parent.parent.parent
ENV_FILE = ".env"


class Config(BaseSettings):
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

    project_home: Path = Field(default=PROJECT_HOME)

    model_config = SettingsConfigDict(case_sensitive=True, env_file=PROJECT_HOME / ".env", extra="allow")

    @model_validator(mode="after")
    def validate_ibind_config(self) -> 'Config':
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

    @property
    def ibind_oauth_config(self) -> OAuth1aConfig:
        """Get OAuth configuration. Should only be called when OAuth is enabled"""
        if not self.ibind_use_oauth:
            raise RuntimeError("OAuth is not enabled. Check ibind_use_oauth setting.")

        return OAuth1aConfig(
            consumer_key=self.ibind_oauth1a_consumer_key,
            encryption_key_fp=self.ibind_oauth1a_encryption_key_fp,
            signature_key_fp=self.ibind_oauth1a_signature_key_fp,
            access_token=self.ibind_oauth1a_access_token,
            access_token_secret=self.ibind_oauth1a_access_token_secret,
            dh_prime=self.ibind_oauth1a_dh_prime,
        )

    @property
    def ibind_client_params(self) -> dict[str, Any]:
        if self.ibind_use_oauth:
            return {"use_oauth": True, "oauth_config": self.ibind_oauth_config}
        return {"port": self.ibeam_port}


config = Config()  # type: ignore
