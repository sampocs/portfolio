# Portfolio

## Auth

- [IBKR Oauth1](https://github.com/Voyz/ibind/wiki/OAuth-1.0a)
- [Coinbase API Keys](https://www.coinbase.com/settings/api)

### IBKR

We connect to IBKR via the ibind python package. There are two ways to connect:

1. Using Oauth1

- This is the cleanest startup, but requires a more involved setup to generate keys and wait at least 24 hours to tokens to become usable
- If using Oauth1, specify the following variables

```
  IBIND_USE_OAUTH=True
  IBIND_OAUTH1A_CONSUMER_KEY=
  IBIND_OAUTH1A_ENCRYPTION_KEY_FP=
  IBIND_OAUTH1A_SIGNATURE_KEY_FP=
  IBIND_OAUTH1A_ACCESS_TOKEN=
  IBIND_OAUTH1A_ACCESS_TOKEN_SECRET=
  IBIND_OAUTH1A_DH_PRIME=
```

2. Using the Gateway

- This consists of setup up a local gateway in docker, and authorizing using 2FA via your phone, and then sending requests through the local client
- This is a non-starter for automated flows due to the 2FA, but it's the easiest way to get started as you only need a user name and password
- The gateway is run via IBeam. You can start it with:

```
IBEAM_ACCOUNT={ibkr_username} IBEAM_PASSWORD='{ibkr_password}' make start-ibeam
```

- Then set the following env variables:

```
IBIND_USE_OAUTH=True
IBEAM_PORT=8000
```

### Robinhood (via SnapTrade)

Robinhood has no official stocks API, so trades are read through SnapTrade, which connects over
Robinhood's OAuth flow and is read-only.

1. Create a Personal account at https://dashboard.snaptrade.com and generate an API key (free)
2. Set `SNAPTRADE_CLIENT_ID`, `SNAPTRADE_CONSUMER_KEY` and `NTFY_TOPIC` in `.env` and on Railway
3. Subscribe to the `NTFY_TOPIC` topic in the ntfy app, which is where disconnect alerts arrive
4. Run `make robinhood-connect` and open the printed URL within 5 minutes, then log in to Robinhood

The connection expires periodically. When it does, the morning sync pushes a notification - tap it
and log in again. Transactions are published by SnapTrade once a day, so trades appear the next morning.

The reconnect link embedded in that notification needs `RAILWAY_PUBLIC_DOMAIN`, which Railway injects
automatically (see `backend/backend/alerts.py`). It isn't set when running locally, so disconnect
alerts are skipped there.

Running `make test` requires a local `.env`, since `backend.config` loads it at import time.

## Historical Exports

### Vanguard

- Only 18 months is available for download, fortunately I had the older data in my spreadsheet already
- The last 18 months was obtained by going to "Activity" -> "Download" -> "Download as CSV"
- The first few sections in the CSV that had the total portfolio value were removed manually from the CSV

### Coinbase

- Go to https://accounts.coinbase.com/statements
- Enter a date range to encapsulate all trades
- Select CSV and download
- Then the first few metadata rows of the CSV were manually removed so that it started with the main headers

## Price Data

### Historical

**Crypto:**

- Download the following CSV manually
- https://www.coingecko.com/en/coins/{token-name}/historical_data?start=2020-01-02&end=2030-01-01
  - Where `{token-name}` is `bitcoin`, `ethereum`, and `solana`

**Stocks**

- Download the following CSV via Pandas (API Key Rate Limits at 25 req/day)
- https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol={symbol}&outputsize=full&datatype=csv&apikey={API_KEY}
  - Where `symbol` is the ticker

### Previous Close Price

**Crypto:**

- Coingecko with API key
- https://api.coingecko.com/api/v3/coins/{token-name}/market_chart?vs_currency=usd&days={N}&interval=daily
- Where `{token-name}` is `bitcoin`, `ethereum`, and `solana` and `{N}` is the number of days to look back

**Stocks:**

- Alpha Vantage with API Key
- https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol={symbol}&outputsize=compact&datatype=json&apikey={API_KEY}
  - Where `symbol` is the ticker

### Live Prices

**Crypto:**

- CoinGecko (Free Tier Rate Limit: 5 req/sec)
- https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd

**Stocks:**

- FinHub (Rate Limit with API Key: 30 req/sec)
- https://finnhub.io/api/v1/quote?symbol={symbol}&token={API_TOKEN}

## Tracking Trades

In order to automatically track trades, they must be done as follows:

- Stocks/ETFs: Executed through IBKR
- Crypto: Executed through Coinbase Advanced
  - For lowest fees, place limit order at highest sell price, and set to "Post Only" (instead of "Taker")
- Robinhood: Executed in the Robinhood app, synced through SnapTrade (appears the next morning)
- Vanguard (Backdoor Roth): Manually added via CSV
  1. Add a CSV to `data/trades/clean/backdoor_roths/vanguard_backdoor_roth_{year}.csv` with columns: `platform,date,action,asset,price,quantity,fees,cost,value`
  2. Run `make sync-backdoor-roth`
- Vanguard (taxable account, no API): Recorded by hand
  1. Append the trade to `data/trades/clean/vanguard_sales/vanguard_sales_{year}.csv` using the next `vanguard-{n}` ID, and set `account=brokerage`
  2. Insert the same row into the `trades` table directly, then rebuild positions and run `make sync-tax-lots`

## Tax Lots

- The `tax_lots` table breaks every brokerage-account sell into the buy-lot slices it consumed under FIFO, with holding period, proceeds, cost, and gain/loss per slice. Roth sells aren't included, since Roth gains aren't taxable.
- It's fully rebuilt from the `trades` table after every trade sync (`make sync-trades` and `make sync-backdoor-roth` both trigger a rebuild), so it's always consistent with the trades. It's documentation for tax time, read from psql or exported as CSV; the brokers' own 1099-Bs remain the filing source.
- `make sync-tax-lots` triggers a manual rebuild, useful after a hand-inserted Vanguard sale.
- `make export-tax-lots` exports the table to `data/tax_lots.csv`, ordered by `date_sold, asset, id`.

## Moving Shares Between Custodians

- When shares physically transfer from one platform to another (e.g. an in-flight Vanguard IRA -> Robinhood Roth IRA transfer), run `make replatform FROM=vanguard TO=robinhood ACCOUNT=roth [ASSET=VT] [EXECUTE=1]` to update where those trades' shares are now held. `platform` (where a trade was originally executed) is never touched, only `custodian` (where the shares live now).
- Every trade in the matched group moves, buys and sells alike - narrowing to only buys would strand the old custodian's sells without lots to match against.
- The command defaults to a dry run: it prints every affected row and per-asset net share totals, and changes nothing. Pass `EXECUTE=1` to commit the move and rebuild tax lots.
- `FROM` and `TO` must be valid platforms (see `Platform` in `backend/backend/config.py`); an unknown value is refused. A filter that matches no rows is reported as a no-op.
- To pause a platform's automatic sync (e.g. while a migration is in flight), set `DISABLED_SYNC_PLATFORMS` in `.env` to a comma-separated list of platforms, e.g. `DISABLED_SYNC_PLATFORMS=ibkr`. Its existing rows are left alone - only the scrape is skipped.
- `trades.custodian` is `not null` with no startup `create_all`, so `python -m backend.bootstrap.add_trade_custodians` must be run against prod BEFORE this code is deployed/merged - running the migration first only briefly breaks the old code's inserts (the next sync retries them), while deploying first breaks every `trades` read with a 500.
- `index_backdoor_roth_trades` inserts new rows with `custodian = row["platform"]`, so after a Vanguard -> Robinhood Roth move, a later `make sync-backdoor-roth` lands new buys back at the old custodian. Re-run `replatform` after any new backdoor Roth import, or record new contributions under the new platform.

## Adding a New Asset

- Add the asset to the config.yaml
- If it's an IBKR asset, get the contractId with: `make contract-id ASSET={asset}`
- Get the asset logo images and save to `frontend/mobile/assets/images/{asset}.png`
- Add the image path to `ASSET_IMAGES` in `frontend/mobile/src/utils/assetRegistry.tsx`
- If it's a crypto asset, download the historical prices from coingecko (see above), and save under `data/prices/raw/{asset}_raw.csv`I
- Add the assets prices to the database with `make add-prices ASSET={asset}`
- Trades will be sync'd automatically

## Known Issues

- For the mobile app, there's dependency issues with some charting libraries. We often need to use `--legacy-peer-deps` when npm installing
