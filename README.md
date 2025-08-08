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

Download CSVs from the following:

- Crypto:
  - https://www.coingecko.com/en/coins/bitcoin/historical_data?start=2025-01-02&end=2030-01-01
  - https://www.coingecko.com/en/coins/solana/historical_data?start=2020-01-02&end=2030-01-01
  - https://www.coingecko.com/en/coins/ethereum/historical_data?start=2020-01-02&end=2030-01-01
- Stocks
  - https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=VT&outputsize=full&datatype=csv&apikey={API_KEY}
  - https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=VOO&outputsize=full&datatype=csv&apikey={API_KEY}
  - https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=VO&outputsize=full&datatype=csv&apikey={API_KEY}
  - https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=VB&outputsize=full&datatype=csv&apikey={API_KEY}
  - https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=VXUS&outputsize=full&datatype=csv&apikey={API_KEY}
  - https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=VWO&outputsize=full&datatype=csv&apikey={API_KEY}
  - https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=COIN&outputsize=full&datatype=csv&apikey={API_KEY}
  - https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=HOOD&outputsize=full&datatype=csv&apikey={API_KEY}
  - https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=AAAU&outputsize=full&datatype=csv&apikey={API_KEY}
  - https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=VNQ&outputsize=full&datatype=csv&apikey={API_KEY}

### Current Price and Previous Close

- Crypto: (Coingecko free tier)
  - https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1&interval=daily
  - https://api.coingecko.com/api/v3/coins/solana/market_chart?vs_currency=usd&days=1&interval=daily
  - https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=1&interval=daily
- Stocks: (Alpha Vantage with API Key)
  - https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VOO&apikey={API_KEY}
  - https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VT&apikey={API_KEY}
  - https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VOO&apikey={API_KEY}
  - https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VO&apikey={API_KEY}
  - https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VB&apikey={API_KEY}
  - https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VXUS&apikey={API_KEY}
  - https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VWO&apikey={API_KEY}
  - https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=COIN&apikey={API_KEY}
  - https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=HOOD&apikey={API_KEY}
  - https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAAU&apikey={API_KEY}
  - https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VNQ&apikey={API_KEY}

## Tracking Trades

In order to automatically track trades, they must be done as follows:

- Stocks/ETFs: Executed through IBKR
- Crypto: Executed through Coinbase Advanced
  - For lowest fees, place limit order at highest sell price, and set to "Post Only" (instead of "Taker")
