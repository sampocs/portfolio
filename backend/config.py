from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

PROJECT_HOME = Path(__file__).parent.parent
ENV_FILE = ".env"


class Config(BaseSettings):
    ibkr_account_id: str = Field(alias="IBIND_ACCOUNT_ID")

    coinbase_api_key: str = Field(alias="COINBASE_API_KEY")
    coinbase_api_secret: str = Field(alias="COINBASE_API_SECRET")

    postgres_url: str = Field(alias="POSTGRES_URL")

    project_home: Path = Field(default=PROJECT_HOME)

    model_config = SettingsConfigDict(case_sensitive=True, env_file=PROJECT_HOME / ".env", extra="allow")


config = Config()  # type: ignore
