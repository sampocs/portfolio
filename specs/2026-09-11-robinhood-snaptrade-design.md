# Robinhood Trade Sync via SnapTrade: Design

- **Date:** 2026-09-11
- **Status:** Design approved; implementation plan not yet written
- **Branch:** `robinhood-snaptrade`

## Goal

Sync Robinhood stock/ETF trades into the `trades` table automatically, the same way IBKR and Coinbase
trades are synced today. Robinhood holdings then flow into current positions and the performance chart.

The Robinhood account is a taxable individual account. It holds tickers already tracked in `assets.yaml`
(e.g. VT, VOO) that are also held at IBKR.

## Background

Robinhood has no official API for stocks; its only public API is for crypto. Options considered:

| Option | Verdict |
|---|---|
| **SnapTrade** | **Chosen.** Free Personal key, read-only Robinhood OAuth connection, Python SDK. |
| Robinhood CSV export | Manual. Fallback if SnapTrade stops working. |
| Plaid Investments | Built for companies: gated production access, paid per connection. |
| Unofficial API (`robin_stocks`) | Rejected. Password and MFA secret on the server, credentials can place trades, breaks on auth changes, violates ToS. |
| Headless-browser re-login | Rejected for the same credential/ToS reasons. Robinhood's new-device approval prompts and bot detection would also likely block it. |

### SnapTrade facts that shape the design

- **Personal keys are free** and represent the key owner directly. There's no `registerSnapTradeUser` and no
  `userId`/`userSecret`. The SDK is `snaptrade-python-sdk` (import `snaptrade_client`); client auth is
  `SnapTradeAuth.personal_api_key(client_id=..., consumer_key=...)` (verified in v13.0.21).
- **Transactions ("activities") are daily and delayed by one day on every plan.** Same-day trades are never
  available. The sync-transactions endpoint is async and only guarantees the previous day, so we don't use it.
- **Connections expire occasionally** and need a browser re-login. SnapTrade's generic docs say "typically a few
  weeks"; Robinhood's real cadence is unknown until we run it.
- **Disabled connections fail silently.** They keep returning the last cached data instead of an error. The
  connection's `disabled` flag is the only signal.
- **Connection Portal URLs expire after 5 minutes.** `login_snap_trade_user` accepts `broker`, `connection_type`,
  `reconnect` (an existing connection ID; requires the same brokerage login), and `custom_redirect`.
- **Activity IDs** are stable "under normal circumstances". They change only if SnapTrade reprocesses the
  brokerage data, which it describes as rare.

## Non-goals

- Same-day trades via the orders endpoint, holdings/balance sync, cash or dividend tracking, trading.
- Automated re-login.
- Crypto or IRA accounts at Robinhood.
- Mobile app changes. `platform` is an opaque string in the app's types, so `"robinhood"` trades render as-is.

## Design

### 1. Platform and config

- Add `Platform.ROBINHOOD = "robinhood"` in `config.py`.
- New `Config` fields, all defaulting to `""` so the app boots without them:
  - `SNAPTRADE_CLIENT_ID`, `SNAPTRADE_CONSUMER_KEY`: the Personal API key.
  - `NTFY_TOPIC`: a random, unguessable ntfy.sh topic for alerts. Topics are readable by anyone who knows the name.
  - `RAILWAY_PUBLIC_DOMAIN`: injected by Railway automatically; used to build reconnect links.
- Add the SnapTrade and ntfy variables to `.env.template`.
- No Robinhood account-ID variable: the account is discovered from the connection.
- `assets.yaml` is unchanged. A ticker's `platform` keeps its current meaning (which IBKR contract IDs get
  queried). The Robinhood sync matches any tracked ticker regardless of its `platform`. Positions are keyed by
  ticker, so a ticker held at both brokers becomes one combined position; each trade row still records its broker.

### 2. SnapTrade helpers: `scrapers/robinhood.py`

Mirrors `scrapers/ibkr.py`: platform helpers plus a small click CLI.

- `get_client()`: SnapTrade client built from the Personal key.
- `get_connection()`: the Robinhood entry from `list_brokerage_authorizations`, or `None` if never connected.
- `get_account_id(connection)`: the investment account under that connection, matched through the account's
  `brokerage_authorization` field. Raises if there isn't exactly one.
- `get_connection_portal_url()`: calls `login_snap_trade_user` with the Robinhood broker, `connection_type="read"`,
  and `reconnect=<connection id>` when a connection exists. With no connection, the portal opens in
  fresh-connect mode.
- CLI: `python -m backend.scrapers.robinhood --connect` prints a portal URL (`make robinhood-connect`). Used for
  first-time setup; works locally without the backend being deployed.

### 3. Trade scraper: `trades.get_recent_robinhood_trades(start_date)`

Lives in `scrapers/trades.py` next to the IBKR and Coinbase scrapers.

1. Look up the connection. If the SnapTrade keys are unset or there's no connection, return `[]` with an info
   log. If the connection is disabled, raise `RobinhoodDisconnectedError`; the job decides whether to alert.
2. Discover the account ID.
3. Fetch activities with `type="BUY,SELL,REI"` from `start_date` (full history when `None`), paging with
   `offset` and `limit=1000`.
4. Skip tickers not in `config.assets`, logging each one.
5. Map each activity to a `models.Trade`:

| Trade field | Source |
|---|---|
| `id` | `robinhood-{activity.id}` |
| `platform` | `"robinhood"` |
| `date` | date part of `trade_date` |
| `action` | `BUY` for `BUY` and `REI`; `SELL` for `SELL` |
| `asset` | `symbol.symbol` |
| `price` | `price` |
| `quantity` | `abs(units)` |
| `fees` | `fee` |
| `cost` | `abs(amount)`: cash in or out including fees, matching IBKR's `amt`. If `amount` is null: `value + fees` for buys, `value - fees` for sells. |
| `value` | `price × quantity` |
| `excluded` | `False` |

- `REI` (dividend reinvestment) adds shares, so it's a buy. Ignoring it would make quantities drift.
- `SPLIT` activities are ignored. The existing split-repair script already adjusts every trade for a ticker.
- ID-change risk is bounded: each sync re-fetches from the last Robinhood trade date, so a reprocessed ID could
  only duplicate that one day's trades.

### 4. Job wiring: `jobs.index_recent_trades`

- Add a third try/except block for Robinhood. Its `start_date` is the latest `robinhood` trade date, or `None`
  when there are no Robinhood trades yet.
- Robinhood is not added to the existing "please seed DB first" assert.
- New parameter `send_alerts: bool = False`. The scheduler's 7am job passes `True`. The app's `/sync` route
  (which can run as often as every 10 minutes) does not. A disconnection therefore produces one alert per morning.
- On `RobinhoodDisconnectedError`: log an error, and send the ntfy alert if `send_alerts` is set. IBKR and
  Coinbase still sync.

### 5. Snapshot rebuild

**Problem:** `historical_positions` rows are written once (at 5am, for the previous day) and never recomputed,
and the performance chart sums them directly. Robinhood trades always arrive after their day's snapshot has
been written. Without a fix, each Robinhood trade leaves a permanent one-day dip in the chart, and a
multi-day disconnection leaves several.

**Fix**, inside `index_recent_trades`:

1. Before storing, find the genuinely new trades: fetched trades whose IDs aren't already in the DB. Every sync
   re-fetches from the last trade date, so "fetched" does not mean "new".
2. If the earliest new trade's date is on or before the latest `historical_positions` date, delete the snapshots
   from that date onward.
3. After storing the trades, call `_fill_historical_positions`. It refills the gap using stored prices.

This applies to every platform. `index_backdoor_roth_trades` also inserts backdated trades, so it calls the same
rebuild.

### 6. Alerts and the reconnect link

**Alert:** a single POST to `https://ntfy.sh/{NTFY_TOPIC}` with a "Robinhood disconnected" title, a short
message, and the reconnect link as the notification's click action. If `NTFY_TOPIC` or `RAILWAY_PUBLIC_DOMAIN`
is empty, the alert is skipped with a warning log.

**Reconnect link:** `https://{RAILWAY_PUBLIC_DOMAIN}/robinhood/connect?expires={unix_ts}&signature={hmac}`

- `signature` is an HMAC-SHA256 of `robinhood-connect:{expires}` keyed with `FASTAPI_SECRET`. Links expire
  after 7 days, and each morning's alert carries a fresh one.
- **Why signed:** a tapped link can't send the app's Bearer header, and a bare URL must not be enough. In
  fresh-connect mode, anyone holding the URL could attach their own Robinhood account, and we'd sync their trades.
- `GET /robinhood/connect` checks the signature (constant-time compare) and expiry, returning 403 on failure.
  It then calls `get_connection_portal_url()` and redirects to the result.
- Reconnect mode requires the same Robinhood login, so the link can only repair the existing connection.

### 7. Setup and docs

Add `snaptrade-python-sdk` to `backend/requirements.txt`.

The README gets a Robinhood entry under "Auth" and a line under "Tracking Trades". Setup steps:

1. Create a Personal account and API key at dashboard.snaptrade.com.
2. Set `SNAPTRADE_CLIENT_ID`, `SNAPTRADE_CONSUMER_KEY` and `NTFY_TOPIC` on Railway and in the local `.env`.
3. Subscribe to the topic in the ntfy app.
4. Run `make robinhood-connect`, open the printed URL within 5 minutes, and log in to Robinhood.
5. When an alert arrives later, tap it and log in again.

## Error handling

| Situation | Behavior |
|---|---|
| SnapTrade keys unset, or never connected | Robinhood skipped with an info log |
| Connection disabled | Error log; the 7am run sends an ntfy alert; other brokers still sync |
| SnapTrade API error | Logged by the Robinhood try/except; other brokers unaffected |
| Untracked ticker traded at Robinhood | Skipped with a warning log |
| Zero or multiple investment accounts under the connection | Raises with a clear message |
| Invalid or expired reconnect link | 403 |

## Testing

- Add `pytest` in a new `backend/requirements-dev.txt`, so Railway's install is unchanged.
- Unit tests for the logic that would fail silently:
  - Activity → `Trade` mapping: buy, sell, `REI`, null `amount`, untracked ticker. The fixture is shaped like
    SnapTrade's documented response and gets replaced with a recorded real response once connected.
  - Reconnect link signing: valid, expired, tampered.
  - Rebuild start date: new vs. already-stored trades, a new trade dated after the latest snapshot (no rebuild),
    and no snapshots at all.
- End-to-end with a real Robinhood trade: connect, trade, sync the next day, then confirm the trade row, the
  `positions` table, and that the chart has no dip on the trade date.

## To verify during implementation

- Robinhood's `broker` slug for `login_snap_trade_user`.
- How Robinhood's investment account is distinguished from deposit accounts under the same connection.
- Robinhood's `trade_date` format and timezone (extended-hours trades can cross midnight UTC).
- Whether `amount` is populated on `REI` activities.
- SDK response shapes (`.body`) for the calls above.
