# Robinhood Trade Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-fast:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync Robinhood stock/ETF trades into the `trades` table through SnapTrade, alongside the existing IBKR and Coinbase syncs.

**Architecture:** A new `scrapers/robinhood.py` owns all SnapTrade I/O (client, connection lookup, account lookup, transaction fetch, Connection Portal URLs). `scrapers/trades.py` converts SnapTrade transactions into `models.Trade` rows, and `jobs.index_recent_trades` stores them like any other platform. Because SnapTrade publishes transactions a day late, trades always arrive after their day's position snapshot has been written, so the job also rebuilds snapshots that a late trade invalidated. A disabled SnapTrade connection returns stale cached data instead of an error, so every sync checks the connection's `disabled` flag and the morning run pushes an ntfy alert carrying a signed reconnect link.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy, APScheduler, `snaptrade-python-sdk`, pytest, ntfy.sh.

**Design spec:** `specs/2026-09-11-robinhood-snaptrade-design.md`

## Global Constraints

- Backend code lives in `backend/backend/`; all commands run from `backend/` (e.g. `cd backend && python -m ...`).
- Imports: module-qualified for functions (`from backend.scrapers import robinhood` then `robinhood.get_client()`). Classes, decorators and `typing.*` may be imported by name.
- Annotate every parameter and return type. Use `X | None`, never `Optional[X]`. Use `Decimal` for money and quantities.
- Use named parameters for any call with more than one argument, except db/session positionals.
- Guard clauses over nesting; comprehensions over append loops; no magic strings (use constants or enum values).
- Every new config field defaults to `""` so the app still boots without it.
- Robinhood failures must never break the IBKR or Coinbase sync: each platform is scraped in its own try/except.
- `backend/requirements.txt` is what Railway installs. Test-only dependencies go in `backend/requirements-dev.txt`.
- Tests run with `cd backend && python -m pytest tests -v` and need a local `.env`, because `backend.config` loads it at import time.
- Commit messages are lowercase and imperative, matching the repo's history. End every commit message with:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GYxweeg1qSzFuethG1Ckzh
```

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/backend/config.py` (modify) | `Platform.ROBINHOOD`, SnapTrade + ntfy settings |
| `backend/backend/scrapers/robinhood.py` (create) | All SnapTrade I/O: client, connection, account, transactions, portal URLs, connect CLI |
| `backend/backend/scrapers/trades.py` (modify) | SnapTrade transaction → `models.Trade` conversion |
| `backend/backend/alerts.py` (create) | ntfy push + signed reconnect link generation/verification |
| `backend/backend/jobs/jobs.py` (modify) | Robinhood scrape block, new-trade detection, snapshot rebuild |
| `backend/backend/jobs/schedules.py` (modify) | Morning run sends alerts |
| `backend/backend/router/routes.py` (modify) | `GET /robinhood/connect` redirect |
| `backend/tests/` (create) | Unit tests for mapping, signing, and snapshot rebuild |
| `Makefile`, `.env.template`, `README.md` (modify) | Setup commands, env vars, docs |

---

## Foundation tasks (run serially, in order)

### Task 1: Config, platform and dependencies

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/requirements-dev.txt`
- Modify: `backend/backend/config.py`
- Modify: `.env.template`
- Modify: `Makefile`

**Interfaces:**
- Produces: `Platform.ROBINHOOD` (value `"robinhood"`); `config.snaptrade_client_id`, `config.snaptrade_consumer_key`, `config.ntfy_topic`, `config.railway_public_domain` (all `str`, default `""`); `config.snaptrade_configured` (`bool` property).
- Review: no

- [ ] **Step 1: Add the SnapTrade SDK to the runtime requirements**

Append to `backend/requirements.txt`:

```
snaptrade-python-sdk==13.0.21
```

- [ ] **Step 2: Create the dev requirements**

Create `backend/requirements-dev.txt`:

```
-r requirements.txt
pytest
```

- [ ] **Step 3: Add the Makefile targets**

Append to `Makefile`:

```makefile
install-dev:
	@$(PYTHON) -m pip install -r backend/requirements-dev.txt

test:
	@(cd backend && $(PYTHON) -m pytest tests -v)

robinhood-connect:
	@(cd backend && $(PYTHON) -m backend.scrapers.robinhood --connect)
```

- [ ] **Step 4: Install the dev dependencies**

Run: `make install-dev`
Expected: pip installs `snaptrade-python-sdk` and `pytest` without errors.

- [ ] **Step 5: Add the platform and settings**

In `backend/backend/config.py`, add the new platform to the existing enum:

```python
class Platform(Enum):
    IBKR = "ibkr"
    COINBASE = "coinbase"
    ROBINHOOD = "robinhood"
```

Add these fields to `Config`, directly below the existing `coinbase_api_key` / `coinbase_api_secret` fields:

```python
    snaptrade_client_id: str = Field(alias="SNAPTRADE_CLIENT_ID", default="")
    snaptrade_consumer_key: str = Field(alias="SNAPTRADE_CONSUMER_KEY", default="")

    ntfy_topic: str = Field(alias="NTFY_TOPIC", default="")
    railway_public_domain: str = Field(alias="RAILWAY_PUBLIC_DOMAIN", default="")
```

Add this property next to the other `@property` definitions (e.g. above `stock_tickers`):

```python
    @property
    def snaptrade_configured(self) -> bool:
        """SnapTrade is optional - without a personal API key, the robinhood sync is skipped"""
        return bool(self.snaptrade_client_id and self.snaptrade_consumer_key)
```

`Asset.from_dict` needs no change: only IBKR assets require a contract ID.

- [ ] **Step 6: Document the new env vars**

Append to `.env.template`:

```
# SnapTrade (Robinhood) auth
SNAPTRADE_CLIENT_ID=
SNAPTRADE_CONSUMER_KEY=

# Disconnect alerts (random, unguessable ntfy.sh topic)
NTFY_TOPIC=
```

`RAILWAY_PUBLIC_DOMAIN` is injected by Railway automatically and is intentionally not in the template.

- [ ] **Step 7: Verify the config loads**

Run: `cd backend && python -c "from backend.config import config, Platform; print(Platform.ROBINHOOD.value, config.snaptrade_configured)"`
Expected: `robinhood False` (or `robinhood True` if the keys are already in `.env`).

- [ ] **Step 8: Commit**

```bash
git add backend/requirements.txt backend/requirements-dev.txt backend/backend/config.py .env.template Makefile
git commit -m "add robinhood platform and snaptrade config"
```

---

### Task 2: SnapTrade connection module

**Files:**
- Create: `backend/backend/scrapers/robinhood.py`
- Create: `backend/tests/test_robinhood.py`
- Modify: `README.md`

**Interfaces:**
- Consumes: `config.snaptrade_client_id`, `config.snaptrade_consumer_key`, `config.snaptrade_configured` (Task 1).
- Produces:
  - `robinhood.RobinhoodDisconnectedError` (Exception)
  - `robinhood.get_client() -> SnapTrade`
  - `robinhood.get_connection(client: SnapTrade) -> dict | None`
  - `robinhood.get_account_id(client: SnapTrade, connection_id: str) -> str`
  - `robinhood.get_activities(client: SnapTrade, account_id: str, start_date: datetime.date | None) -> list[dict]`
  - `robinhood.get_connection_portal_url() -> str`
- Depends on: Task 1
- Review: yes

- [ ] **Step 1: Write the failing tests for the pure lookup helpers**

Create `backend/tests/test_robinhood.py`:

```python
import pytest

from backend.scrapers import robinhood


def test_find_connection_returns_robinhood_entry():
    authorizations = [
        {"id": "auth-1", "disabled": False, "brokerage": {"slug": "ALPACA"}},
        {"id": "auth-2", "disabled": False, "brokerage": {"slug": "ROBINHOOD"}},
    ]
    assert robinhood._find_connection(authorizations)["id"] == "auth-2"


def test_find_connection_returns_none_when_not_connected():
    authorizations = [{"id": "auth-1", "disabled": False, "brokerage": {"slug": "ALPACA"}}]
    assert robinhood._find_connection(authorizations) is None


def test_find_account_id_matches_the_connection():
    accounts = [
        {"id": "account-1", "brokerage_authorization": "auth-1"},
        {"id": "account-2", "brokerage_authorization": "auth-2"},
    ]
    assert robinhood._find_account_id(accounts=accounts, connection_id="auth-2") == "account-2"


def test_find_account_id_rejects_ambiguous_accounts():
    accounts = [
        {"id": "account-1", "brokerage_authorization": "auth-2"},
        {"id": "account-2", "brokerage_authorization": "auth-2"},
    ]
    with pytest.raises(AssertionError):
        robinhood._find_account_id(accounts=accounts, connection_id="auth-2")
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `make test`
Expected: FAIL with `ModuleNotFoundError: No module named 'backend.scrapers.robinhood'`.

- [ ] **Step 3: Write the module**

Create `backend/backend/scrapers/robinhood.py`:

```python
import datetime
import json
from typing import Any

import click
from snaptrade_client import SnapTrade, SnapTradeAuth

from backend.config import config, logger

BROKERAGE_SLUG = "ROBINHOOD"
CONNECTION_TYPE_READ_ONLY = "read"
TRADE_ACTIVITY_TYPES = "BUY,SELL,REI"
ACTIVITY_PAGE_SIZE = 1000


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
    return _find_account_id(accounts=_response_json(response), connection_id=connection_id)


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

    while True:
        response = client.account_information.get_account_activities(
            account_id=account_id,
            start_date=start_date,
            type=TRADE_ACTIVITY_TYPES,
            offset=offset,
            limit=ACTIVITY_PAGE_SIZE,
        )
        page = _response_json(response)["data"]
        activities += page

        # A short page means there's nothing left to fetch
        if len(page) < ACTIVITY_PAGE_SIZE:
            return activities

        offset += ACTIVITY_PAGE_SIZE


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
    Returns the ID of the single account under the given connection

    A robinhood connection can also expose non-brokerage accounts (e.g. spending),
    so an ambiguous result is raised rather than guessed at
    """
    account_ids = [
        account["id"]
        for account in accounts
        if account["brokerage_authorization"] == connection_id
    ]

    assert len(account_ids) == 1, (
        f"Expected one robinhood account, found {len(account_ids)}: {account_ids}"
    )
    return account_ids[0]


@click.command()
@click.option("--connect", is_flag=True, help="Print a Connection Portal URL to link or repair Robinhood")
def main(connect: bool):
    assert connect, "Only permitted option is --connect"
    logger.info("Portal URL expires in 5 minutes")
    print(get_connection_portal_url())


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `make test`
Expected: 4 passed.

- [ ] **Step 5: Document the setup in the README**

Add to `README.md`, under the `## Auth` section after the IBKR and Coinbase entries:

```markdown
### Robinhood (via SnapTrade)

Robinhood has no official stocks API, so trades are read through SnapTrade, which connects over
Robinhood's OAuth flow and is read-only.

1. Create a Personal account at https://dashboard.snaptrade.com and generate an API key (free)
2. Set `SNAPTRADE_CLIENT_ID`, `SNAPTRADE_CONSUMER_KEY` and `NTFY_TOPIC` in `.env` and on Railway
3. Subscribe to the `NTFY_TOPIC` topic in the ntfy app, which is where disconnect alerts arrive
4. Run `make robinhood-connect` and open the printed URL within 5 minutes, then log in to Robinhood

The connection expires periodically. When it does, the morning sync pushes a notification - tap it
and log in again. Transactions are published by SnapTrade once a day, so trades appear the next morning.
```

- [ ] **Step 6: Connect the live account (manual, requires the SnapTrade key in `.env`)**

Run: `make robinhood-connect`
Expected: a `https://app.snaptrade.com/...` URL. Open it, log in to Robinhood, and confirm the portal reports success.

Then verify the connection and account lookups resolve:

Run:
```bash
cd backend && python -c "
from backend.scrapers import robinhood
client = robinhood.get_client()
connection = robinhood.get_connection(client)
print('connection:', connection['id'], 'disabled:', connection['disabled'])
print('account:', robinhood.get_account_id(client=client, connection_id=connection['id']))
print('activities:', robinhood.get_activities(client=client, account_id=robinhood.get_account_id(client=client, connection_id=connection['id']), start_date=None))
"
```
Expected: a connection ID with `disabled: False`, one account ID, and a list of activities (empty until a trade settles).

If `_find_connection` raises or returns `None`, print the raw brokerage slugs and fix `BROKERAGE_SLUG`:
`cd backend && python -c "from backend.scrapers import robinhood; c=robinhood.get_client(); print([a['brokerage']['slug'] for a in robinhood._response_json(c.connections.list_brokerage_authorizations())])"`

- [ ] **Step 7: Commit**

```bash
git add backend/backend/scrapers/robinhood.py backend/tests/test_robinhood.py README.md
git commit -m "add snaptrade connection module for robinhood"
```

---

### Task 3: Disconnect alerts and signed reconnect links

**Files:**
- Create: `backend/backend/alerts.py`
- Create: `backend/tests/test_alerts.py`

**Interfaces:**
- Consumes: `config.ntfy_topic`, `config.railway_public_domain`, `config.fastapi_secret` (Task 1).
- Produces:
  - `alerts.build_reconnect_link() -> str`
  - `alerts.is_valid_reconnect_signature(expires: int, signature: str) -> bool`
  - `alerts.send_robinhood_disconnected_alert() -> None`
- Depends on: Task 1
- Review: yes

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_alerts.py`:

```python
import time
from urllib.parse import parse_qs, urlparse

from backend import alerts


def _parse_link(link: str) -> dict[str, str]:
    query = parse_qs(urlparse(link).query)
    return {key: values[0] for key, values in query.items()}


def test_generated_link_is_valid():
    params = _parse_link(alerts.build_reconnect_link())
    assert alerts.is_valid_reconnect_signature(
        expires=int(params["expires"]), signature=params["signature"]
    )


def test_expired_link_is_rejected():
    expires = int(time.time()) - 1
    signature = alerts._sign_reconnect_link(expires)
    assert not alerts.is_valid_reconnect_signature(expires=expires, signature=signature)


def test_tampered_expiry_is_rejected():
    params = _parse_link(alerts.build_reconnect_link())
    extended_expiry = int(params["expires"]) + 1000
    assert not alerts.is_valid_reconnect_signature(
        expires=extended_expiry, signature=params["signature"]
    )


def test_tampered_signature_is_rejected():
    params = _parse_link(alerts.build_reconnect_link())
    assert not alerts.is_valid_reconnect_signature(expires=int(params["expires"]), signature="deadbeef")


def test_alert_is_skipped_when_unconfigured(monkeypatch):
    monkeypatch.setattr(alerts.config, "ntfy_topic", "")

    posted = []
    monkeypatch.setattr(alerts.requests, "post", lambda *args, **kwargs: posted.append(kwargs))

    alerts.send_robinhood_disconnected_alert()
    assert posted == []


def test_alert_posts_to_the_topic(monkeypatch):
    monkeypatch.setattr(alerts.config, "ntfy_topic", "test-topic")
    monkeypatch.setattr(alerts.config, "railway_public_domain", "api.example.com")

    posted = {}
    monkeypatch.setattr(
        alerts.requests, "post", lambda url, **kwargs: posted.update({"url": url, **kwargs})
    )

    alerts.send_robinhood_disconnected_alert()
    assert posted["url"] == "https://ntfy.sh/test-topic"
    assert posted["headers"]["Click"].startswith("https://api.example.com/robinhood/connect?")
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `make test`
Expected: FAIL with `ModuleNotFoundError: No module named 'backend.alerts'`.

- [ ] **Step 3: Write the module**

Create `backend/backend/alerts.py`:

```python
import hashlib
import hmac
import time

import requests

from backend.config import config, logger

NTFY_URL = "https://ntfy.sh/{}"
RECONNECT_PATH = "/robinhood/connect"
RECONNECT_LINK_TTL_SECONDS = 7 * 24 * 60 * 60
SIGNATURE_MESSAGE = "robinhood-connect:{}"
REQUEST_TIMEOUT_SECONDS = 10


def build_reconnect_link() -> str:
    """Builds a signed, expiring link to the reconnect endpoint"""
    expires = int(time.time()) + RECONNECT_LINK_TTL_SECONDS
    signature = _sign_reconnect_link(expires)
    return f"https://{config.railway_public_domain}{RECONNECT_PATH}?expires={expires}&signature={signature}"


def is_valid_reconnect_signature(expires: int, signature: str) -> bool:
    """Returns whether the link is correctly signed and hasn't expired"""
    if expires < int(time.time()):
        return False

    return hmac.compare_digest(_sign_reconnect_link(expires), signature)


def send_robinhood_disconnected_alert() -> None:
    """
    Pushes a notification with a one-tap reconnect link

    A disabled SnapTrade connection keeps serving stale cached data rather than failing,
    so without this alert a broken connection would go unnoticed
    """
    if not config.ntfy_topic or not config.railway_public_domain:
        logger.warning("Alerts are not configured, skipping the robinhood disconnect notification")
        return

    requests.post(
        NTFY_URL.format(config.ntfy_topic),
        data="Tap to log back in to Robinhood",
        headers={
            "Title": "Robinhood disconnected",
            "Click": build_reconnect_link(),
            "Tags": "warning",
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )


def _sign_reconnect_link(expires: int) -> str:
    """
    Signs the link with the API secret

    The link is opened from a notification, which can't send the API's bearer header.
    Without a signature, anyone holding the URL could attach their own brokerage
    account to this SnapTrade user and have their trades synced here
    """
    message = SIGNATURE_MESSAGE.format(expires).encode()
    return hmac.new(config.fastapi_secret.encode(), message, hashlib.sha256).hexdigest()
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `make test`
Expected: 6 passed (plus Task 2's 4).

- [ ] **Step 5: Commit**

```bash
git add backend/backend/alerts.py backend/tests/test_alerts.py
git commit -m "add ntfy disconnect alert with signed reconnect link"
```

---

## Parallel-safe tasks

Tasks 4, 5 and 6 depend only on the foundation tasks above, never on each other. Tasks 4 and 5 both
edit `jobs.index_recent_trades` in different places; that textual overlap is resolved at merge time.

### Task 4: Robinhood trade scraper and job wiring

**Files:**
- Modify: `backend/backend/scrapers/trades.py`
- Modify: `backend/backend/jobs/jobs.py:90-136` (`index_recent_trades`)
- Modify: `backend/backend/jobs/schedules.py`
- Create: `backend/tests/test_robinhood_trades.py`
- Modify: `README.md`

**Interfaces:**
- Consumes: `robinhood.get_client`, `robinhood.get_connection`, `robinhood.get_account_id`, `robinhood.get_activities`, `robinhood.RobinhoodDisconnectedError` (Task 2); `alerts.send_robinhood_disconnected_alert` (Task 3); `Platform.ROBINHOOD`, `config.snaptrade_configured` (Task 1).
- Produces: `trades.get_recent_robinhood_trades(start_date: datetime.date | None) -> list[models.Trade]`; `jobs.index_recent_trades(db: Session, send_alerts: bool = False)`.
- Depends on: Tasks 1-3
- Review: yes

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_robinhood_trades.py`:

```python
from decimal import Decimal

from backend.scrapers import trades


def _activity(**overrides) -> dict:
    activity = {
        "id": "abc-123",
        "type": "BUY",
        "symbol": {"symbol": "VOO"},
        "price": 500.0,
        "units": 2.0,
        "fee": 0.0,
        "amount": -1000.0,
        "trade_date": "2026-09-10T14:30:00.000Z",
    }
    return {**activity, **overrides}


def test_buy_maps_to_a_trade():
    trade = trades._build_robinhood_trade(_activity())

    assert trade.id == "robinhood-abc-123"
    assert trade.platform == "robinhood"
    assert trade.date == "2026-09-10"
    assert trade.action == "BUY"
    assert trade.asset == "VOO"
    assert trade.price == Decimal("500")
    assert trade.quantity == Decimal("2")
    assert trade.cost == Decimal("1000")
    assert trade.value == Decimal("1000")


def test_sell_uses_positive_quantity():
    trade = trades._build_robinhood_trade(_activity(type="SELL", units=-2.0, amount=999.0, fee=1.0))

    assert trade.action == "SELL"
    assert trade.quantity == Decimal("2")
    assert trade.fees == Decimal("1")
    assert trade.cost == Decimal("999")


def test_dividend_reinvestment_maps_to_a_buy():
    trade = trades._build_robinhood_trade(_activity(type="REI", units=0.1, amount=None))

    assert trade.action == "BUY"
    assert trade.quantity == Decimal("0.1")
    assert trade.cost == Decimal("50")


def test_missing_amount_on_a_sell_subtracts_fees():
    trade = trades._build_robinhood_trade(_activity(type="SELL", units=-2.0, amount=None, fee=1.0))

    assert trade.cost == Decimal("999")


def test_date_only_timestamps_are_kept():
    trade = trades._build_robinhood_trade(_activity(trade_date="2026-09-10"))

    assert trade.date == "2026-09-10"


def test_after_hours_utc_timestamp_uses_the_market_date():
    trade = trades._build_robinhood_trade(_activity(trade_date="2026-09-11T00:30:00.000Z"))

    assert trade.date == "2026-09-10"


def test_untracked_tickers_are_skipped():
    activities = [_activity(), _activity(id="xyz-789", symbol={"symbol": "NOTREAL"})]

    tracked = [activity for activity in activities if trades._is_tracked_activity(activity)]
    assert [activity["id"] for activity in tracked] == ["abc-123"]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `make test`
Expected: FAIL with `AttributeError: module 'backend.scrapers.trades' has no attribute '_build_robinhood_trade'`.

- [ ] **Step 3: Write the scraper**

In `backend/backend/scrapers/trades.py`, add to the imports at the top:

```python
import zoneinfo

from backend.config import config, Platform, logger
from backend.scrapers import robinhood
```

(`config` and `Platform` are already imported; add `logger` to that import and the two new modules.)

Add this constant below the imports:

```python
# Extended-hours fills land on the next UTC day, so timestamps are read in market time
MARKET_TIMEZONE = zoneinfo.ZoneInfo("America/New_York")
```

Add these functions at the end of the file:

```python
def get_recent_robinhood_trades(start_date: datetime.date | None) -> list[models.Trade]:
    """
    Scrapes recent robinhood trades through SnapTrade
    :param start_date: First date to query transactions from, inclusively.
                       None pulls the account's full history
    """
    if not config.snaptrade_configured:
        logger.info("SnapTrade is not configured, skipping robinhood trades")
        return []

    client = robinhood.get_client()
    connection = robinhood.get_connection(client)
    if not connection:
        logger.info("Robinhood is not connected, skipping robinhood trades")
        return []

    # A disabled connection keeps returning stale cached data instead of failing,
    # so this flag is the only signal that it needs to be re-authorized
    if connection["disabled"]:
        raise robinhood.RobinhoodDisconnectedError()

    account_id = robinhood.get_account_id(client=client, connection_id=connection["id"])
    activities = robinhood.get_activities(
        client=client, account_id=account_id, start_date=start_date
    )

    tracked_activities = [
        activity for activity in activities if _is_tracked_activity(activity)
    ]
    return [_build_robinhood_trade(activity) for activity in tracked_activities]


def _is_tracked_activity(activity: dict) -> bool:
    """Returns whether the transaction is for an asset in the portfolio config"""
    symbol = activity["symbol"]
    if symbol and symbol["symbol"] in config.assets:
        return True

    logger.warning(f"Skipping robinhood transaction for untracked asset: {symbol}")
    return False


def _build_robinhood_trade(activity: dict) -> models.Trade:
    """Converts a SnapTrade transaction into a trade"""
    is_sell = activity["type"] == models.TradeAction.SELL.value
    action = models.TradeAction.SELL if is_sell else models.TradeAction.BUY

    price = Decimal(str(activity["price"]))
    quantity = abs(Decimal(str(activity["units"])))
    fees = Decimal(str(activity["fee"] or 0))
    value = price * quantity

    # Dividend reinvestments don't always carry a cash amount, in which case the cash
    # moved is the trade value plus the fees on a buy, or minus the fees on a sell
    fee_direction = -1 if is_sell else 1
    cost = (
        abs(Decimal(str(activity["amount"])))
        if activity["amount"] is not None
        else value + fee_direction * fees
    )

    return models.Trade(
        id=f"robinhood-{activity['id']}",
        platform=Platform.ROBINHOOD.value,
        date=_get_market_date(activity["trade_date"]),
        action=action.value,
        asset=activity["symbol"]["symbol"],
        price=price,
        quantity=quantity,
        fees=fees,
        cost=cost,
        value=value,
        excluded=False,
    )


def _get_market_date(trade_date: str) -> str:
    """
    Returns the date a transaction should be attributed to

    SnapTrade timestamps are UTC, where an evening fill rolls into the next day,
    so anything with a time component is converted to market time first
    """
    parsed_date = datetime.datetime.fromisoformat(trade_date.replace("Z", "+00:00"))
    if parsed_date.tzinfo is None:
        return parsed_date.date().isoformat()

    return parsed_date.astimezone(MARKET_TIMEZONE).date().isoformat()
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `make test`
Expected: 7 passed from this file.

- [ ] **Step 5: Wire the scraper into the job**

In `backend/backend/jobs/jobs.py`, add the import for the alerts module at the top:

```python
from backend import alerts
```

Change the signature of `index_recent_trades` and add the robinhood block. The function becomes:

```python
def index_recent_trades(db: Session, send_alerts: bool = False):
    """
    Checks for any recent crypto or stock trades and saves them in the database
    :param send_alerts: Whether a broken robinhood connection should push a notification.
                        Only the scheduled run sets this - the app's sync endpoint runs
                        far more often and would notify repeatedly
    """
    last_ibkr_trade_date = (
        db.query(func.max(models.Trade.date))
        .filter(models.Trade.platform == Platform.IBKR.value)
        .scalar()
    )
    last_coinbase_trade_date = (
        db.query(func.max(models.Trade.date))
        .filter(models.Trade.platform == Platform.COINBASE.value)
        .scalar()
    )
    assert last_ibkr_trade_date and last_coinbase_trade_date, (
        "No trades present, please seed DB first"
    )

    # Robinhood is intentionally left out of the assert above: there are no robinhood
    # trades until the first one syncs, and a missing date pulls the full history
    last_robinhood_trade_date = (
        db.query(func.max(models.Trade.date))
        .filter(models.Trade.platform == Platform.ROBINHOOD.value)
        .scalar()
    )

    try:
        logger.info(f"Checking for stock trades since {last_ibkr_trade_date}...")
        stock_trades = trades.get_recent_ibkr_trades(
            db=db, start_date=last_ibkr_trade_date
        )
        logger.info(f"Found {len(stock_trades)} stock trades")
    except Exception as e:
        logger.error(f"Failed to scrape stock trades: {e}")
        stock_trades = []

    try:
        logger.info(f"Checking for crypto trades since {last_coinbase_trade_date}...")
        crypto_trades = trades.get_recent_coinbase_trades(
            start_date=last_coinbase_trade_date
        )
        logger.info(f"Found {len(crypto_trades)} crypto trades")
    except Exception as e:
        logger.error(f"Failed to scrape crypto trades: {e}")
        crypto_trades = []

    try:
        logger.info(f"Checking for robinhood trades since {last_robinhood_trade_date}...")
        robinhood_trades = trades.get_recent_robinhood_trades(
            start_date=last_robinhood_trade_date
        )
        logger.info(f"Found {len(robinhood_trades)} robinhood trades")
    except robinhood.RobinhoodDisconnectedError:
        logger.error("Robinhood connection is disabled and must be re-authorized")
        robinhood_trades = []
        if send_alerts:
            alerts.send_robinhood_disconnected_alert()
    except Exception as e:
        logger.error(f"Failed to scrape robinhood trades: {e}")
        robinhood_trades = []

    logger.info("Writing trades to DB")
    all_trades = stock_trades + crypto_trades + robinhood_trades
    crud.store_trades(db, all_trades)

    logger.info("Updating current position")
    positions = crud.build_positions_from_trades(db)
    crud.store_positions(db, positions)

    logger.info("Done")
```

Add the two imports this needs at the top of the file:

```python
from backend.config import config, logger, Platform
from backend.scrapers import prices, trades, robinhood
```

(`config` and `logger` are already imported from `backend.config`; add `Platform`, and add `robinhood` to the scrapers import.)

- [ ] **Step 6: Send alerts from the scheduled run only**

In `backend/backend/jobs/schedules.py`, update the trades job:

```python
        scheduler.add_job(
            jobs.index_recent_trades,
            "cron",
            args=[db],
            kwargs={"send_alerts": True},
            hour="7",
            minute=0,
            timezone=TIMEZONE,
        )
```

- [ ] **Step 7: Verify the job runs end to end**

Run: `make sync-trades`
Expected: the log shows `Checking for robinhood trades since None...` followed by `Found 0 robinhood trades` (0 until a trade settles), and the IBKR and Coinbase lines are unchanged.

- [ ] **Step 8: Document it in the README**

In `README.md`, under `## Tracking Trades`, add to the list of how trades must be executed:

```markdown
- Robinhood: Executed in the Robinhood app, synced through SnapTrade (appears the next morning)
```

- [ ] **Step 9: Commit**

```bash
git add backend/backend/scrapers/trades.py backend/backend/jobs/jobs.py backend/backend/jobs/schedules.py backend/tests/test_robinhood_trades.py README.md
git commit -m "sync robinhood trades from snaptrade"
```

---

### Task 5: Rebuild position snapshots invalidated by late trades

**Files:**
- Modify: `backend/backend/jobs/jobs.py:90-188` (`index_recent_trades`, `index_backdoor_roth_trades`)
- Create: `backend/tests/test_snapshot_rebuild.py`

**Interfaces:**
- Consumes: `models.Trade`, `models.HistoricalPosition`, `crud.store_trades` (existing).
- Produces: `jobs._get_new_trades(db: Session, scraped_trades: list[models.Trade]) -> list[models.Trade]`; `jobs._clear_stale_position_snapshots(db: Session, new_trades: list[models.Trade]) -> None`.
- Depends on: Task 1
- Review: yes

**Context:** `historical_positions` rows are inserted once by `_fill_historical_positions` and never
recomputed, and `/performance` sums them directly. A trade stored after its date's snapshot was written
therefore leaves a permanent gap in the chart. Robinhood trades always arrive a day late, so this
happens on every single one.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_snapshot_rebuild.py`:

```python
import datetime
from decimal import Decimal

import pytest
import sqlalchemy
from sqlalchemy.orm import sessionmaker

from backend.database import models
from backend.jobs import jobs


@pytest.fixture
def db():
    engine = sqlalchemy.create_engine("sqlite:///:memory:")
    models.Base.metadata.create_all(engine)
    with sessionmaker(bind=engine)() as session:
        yield session


def _trade(trade_id: str, date: str) -> models.Trade:
    return models.Trade(
        id=trade_id,
        platform="robinhood",
        date=date,
        action="BUY",
        asset="VOO",
        price=Decimal("500"),
        quantity=Decimal("1"),
        fees=Decimal("0"),
        cost=Decimal("500"),
        value=Decimal("500"),
        excluded=False,
    )


def _snapshot(date: str) -> models.HistoricalPosition:
    return models.HistoricalPosition(
        asset="VOO",
        date=date,
        average_position_price=Decimal("500"),
        daily_close_price=Decimal("500"),
        quantity=Decimal("1"),
        cost=Decimal("500"),
        value=Decimal("500"),
        returns=Decimal("0"),
    )


def test_only_unstored_trades_are_new(db):
    db.add(_trade("robinhood-1", "2026-09-10"))
    db.commit()

    scraped = [_trade("robinhood-1", "2026-09-10"), _trade("robinhood-2", "2026-09-11")]
    assert [trade.id for trade in jobs._get_new_trades(db, scraped)] == ["robinhood-2"]


def test_late_trade_clears_snapshots_from_its_date(db):
    db.add_all([_snapshot("2026-09-09"), _snapshot("2026-09-10"), _snapshot("2026-09-11")])
    db.commit()

    jobs._clear_stale_position_snapshots(db, [_trade("robinhood-2", "2026-09-10")])

    remaining = [row.date for row in db.query(models.HistoricalPosition).all()]
    assert remaining == [datetime.date(2026, 9, 9)]


def test_trade_after_the_last_snapshot_clears_nothing(db):
    db.add_all([_snapshot("2026-09-09"), _snapshot("2026-09-10")])
    db.commit()

    jobs._clear_stale_position_snapshots(db, [_trade("robinhood-2", "2026-09-11")])

    assert db.query(models.HistoricalPosition).count() == 2


def test_no_snapshots_clears_nothing(db):
    jobs._clear_stale_position_snapshots(db, [_trade("robinhood-2", "2026-09-11")])

    assert db.query(models.HistoricalPosition).count() == 0


def test_no_new_trades_clears_nothing(db):
    db.add(_snapshot("2026-09-10"))
    db.commit()

    jobs._clear_stale_position_snapshots(db, [])

    assert db.query(models.HistoricalPosition).count() == 1
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `make test`
Expected: FAIL with `AttributeError: module 'backend.jobs.jobs' has no attribute '_get_new_trades'`.

- [ ] **Step 3: Write the helpers**

Add to `backend/backend/jobs/jobs.py`, above `index_recent_trades`:

```python
def _get_new_trades(db: Session, scraped_trades: list[models.Trade]) -> list[models.Trade]:
    """
    Returns the scraped trades that aren't stored yet

    Each sync re-fetches from the last known trade date, so most scraped trades
    already exist and only the genuinely new ones can invalidate a snapshot
    """
    if not scraped_trades:
        return []

    scraped_ids = [trade.id for trade in scraped_trades]
    existing_ids = {
        row.id
        for row in db.query(models.Trade.id).filter(models.Trade.id.in_(scraped_ids)).all()
    }

    return [trade for trade in scraped_trades if trade.id not in existing_ids]


def _clear_stale_position_snapshots(db: Session, new_trades: list[models.Trade]) -> None:
    """
    Deletes the position snapshots dated on or after the earliest new trade

    Snapshots are written once per day and never revisited, so a trade that lands after
    its date's snapshot leaves a permanent gap in the performance chart. This always
    happens with robinhood, since SnapTrade publishes transactions a day late.
    The cleared dates are rebuilt from stored prices by _fill_historical_positions
    """
    if not new_trades:
        return

    # Trades are built with string dates, so they're parsed before comparing
    earliest_trade_date = min(
        datetime.date.fromisoformat(str(trade.date)) for trade in new_trades
    )
    last_snapshot_date = db.query(func.max(models.HistoricalPosition.date)).scalar()
    if not last_snapshot_date or earliest_trade_date > last_snapshot_date:
        return

    logger.info(f"Rebuilding position snapshots from {earliest_trade_date}")
    db.query(models.HistoricalPosition).filter(
        models.HistoricalPosition.date >= earliest_trade_date
    ).delete()
    db.commit()
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `make test`
Expected: 5 passed from this file.

- [ ] **Step 5: Call the rebuild from the trade sync**

In `index_recent_trades`, replace the storing section (the `logger.info("Writing trades to DB")` block
through `logger.info("Done")`) with:

```python
    # Late trades invalidate the snapshots written for their date, so those are
    # cleared before storing and rebuilt immediately after
    new_trades = _get_new_trades(db, all_trades)

    logger.info("Writing trades to DB")
    crud.store_trades(db, all_trades)
    _clear_stale_position_snapshots(db, new_trades)

    logger.info("Updating current position")
    positions = crud.build_positions_from_trades(db)
    crud.store_positions(db, positions)

    _fill_historical_positions(db)

    logger.info("Done")
```

- [ ] **Step 6: Call the rebuild from the backdoor roth import**

In `index_backdoor_roth_trades`, replace the storing section (from `logger.info(f"Inserting ...")`
through `logger.info("Done")`) with:

```python
    logger.info(f"Inserting {len(trade_objects)} backdoor roth trades (vanguard-{next_id - len(trade_objects)} to vanguard-{next_id - 1})")
    crud.store_trades(db, trade_objects)

    # These are backdated trades, so their snapshots have to be rebuilt too
    _clear_stale_position_snapshots(db, trade_objects)

    logger.info("Updating current position")
    positions = crud.build_positions_from_trades(db)
    crud.store_positions(db, positions)

    _fill_historical_positions(db)

    logger.info("Done")
```

- [ ] **Step 7: Verify against the real database**

Run: `make sync-trades`
Expected: it completes without errors. With no new trades, no `Rebuilding position snapshots` line appears
and `Positions already updated` is logged.

- [ ] **Step 8: Commit**

```bash
git add backend/backend/jobs/jobs.py backend/tests/test_snapshot_rebuild.py
git commit -m "rebuild position snapshots when trades arrive late"
```

---

### Task 6: Reconnect endpoint

**Files:**
- Modify: `backend/backend/router/routes.py`

**Interfaces:**
- Consumes: `alerts.is_valid_reconnect_signature` (Task 3); `robinhood.get_connection_portal_url` (Task 2).
- Produces: `GET /robinhood/connect?expires=<int>&signature=<hex>` → 307 redirect to the SnapTrade portal, or 403.
- Depends on: Tasks 1-3
- Review: yes

- [ ] **Step 1: Add the route**

In `backend/backend/router/routes.py`, add to the imports:

```python
from fastapi.responses import RedirectResponse

from backend import alerts
from backend.scrapers import robinhood
```

Add the route at the end of the file:

```python
@router.get("/robinhood/connect")
def robinhood_connect(expires: int, signature: str):
    """
    Redirects to a freshly minted SnapTrade Connection Portal URL

    This is the link carried by the disconnect notification. It's opened from a phone
    rather than the app, so it authenticates with a signed query string instead of the
    bearer token, and mints the portal URL on demand because those expire in 5 minutes
    """
    if not alerts.is_valid_reconnect_signature(expires=expires, signature=signature):
        raise HTTPException(status_code=403, detail="Invalid or expired link")

    return RedirectResponse(robinhood.get_connection_portal_url())
```

- [ ] **Step 2: Verify a tampered link is rejected**

Start the API: `make start-api`

In another shell, run: `curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000/robinhood/connect?expires=99999999999&signature=deadbeef"`
Expected: `403`

- [ ] **Step 3: Verify a valid link redirects**

Run:
```bash
cd backend && python -c "
from backend import alerts
print(alerts.build_reconnect_link())
"
```

Take the `expires` and `signature` from the printed link and run:
`curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000/robinhood/connect?expires=<expires>&signature=<signature>"`
Expected: `307`, and following it (`curl -sL -o /dev/null -w "%{url_effective}"`) lands on an `app.snaptrade.com` URL.

- [ ] **Step 4: Commit**

```bash
git add backend/backend/router/routes.py
git commit -m "add robinhood reconnect endpoint"
```

---

## Final verification (manual, after the plan's tasks are merged)

These steps need the live account and are run with the user, not by a subagent.

- [ ] **Step 1: Full test suite**

Run: `make test`
Expected: all tests pass.

- [ ] **Step 2: Deploy**

Push the branch and merge to main; Railway redeploys the backend. Set `SNAPTRADE_CLIENT_ID`,
`SNAPTRADE_CONSUMER_KEY` and `NTFY_TOPIC` in the Railway service variables first, or the sync stays
skipped.

- [ ] **Step 3: Confirm the first real trade (the day after trading)**

SnapTrade publishes transactions a day late, so a trade made today can only be verified tomorrow.

Run: `make sync-trades`
Expected: `Found 1 robinhood trades`, then `Rebuilding position snapshots from <trade date>`.

Then check the row and the chart:
```bash
cd backend && python -c "
from backend.database import connection, models
with connection.SessionLocal() as db:
    for trade in db.query(models.Trade).filter(models.Trade.platform == 'robinhood').all():
        print(trade.id, trade.date, trade.action, trade.asset, trade.quantity, trade.price, trade.cost)
"
```
Expected: the trade matches the Robinhood app's confirmation (date, quantity, price), the app's
positions include it, and the total-value chart has no dip on the trade date.

- [ ] **Step 4: Confirm the disconnect alert**

This can't be forced, since only Robinhood can disable the connection. When the first alert arrives,
tap it, confirm it lands on a Robinhood login, log in, and confirm the next sync succeeds.
