# Tax lots table

## Goal

A `tax_lots` table that breaks every taxable sell into the buy-lot slices it consumed under
FIFO, with holding period, proceeds, cost, and gain/loss per slice. It is rebuilt from the
`trades` table after every trade sync, so it is always consistent with the trades. It is
documentation for tax time, read from psql or exported as CSV; the brokers' own 1099-Bs
remain the filing source.

Along the way, trades learn which account they belong to (`brokerage` vs `roth`), and the
position builder starts matching lots per account instead of pooling every platform
together, which is how brokers actually track basis.

## Decisions already made

- FIFO only. No specific-lot override. Vanguard's default is FIFO, so sales made without
  changing the lot method will match this table.
- Roth lots are tagged, not pooled. The tag lives in a new `account` column, not in the
  platform value, so scraper routing and the app's platform labels are untouched.
- DB table plus a `make` export target. No API endpoint, no desktop page.
- Full rebuild after each sync, sharing one FIFO matcher with positions. No incremental
  path, no SQL view.
- Positions keep one row per asset. Matching happens per account; the row sums what's left.

## Data model

### `trades.account`

New not-null string column. Values come from a `TradeAccount` `StrEnum` in `models.py`
next to `TradeAction`: `BROKERAGE = "brokerage"`, `ROTH = "roth"`. Column default is
`brokerage`.

- Every scraper (IBKR, Coinbase, Robinhood) stamps `brokerage`.
- The backdoor Roth job stamps `roth`.
- `data/trades/clean/vanguard_clean.csv` and `coinbase_clean.csv` gain an `account` column
  so `seed.py` produces a correct DB from scratch. `vanguard_clean.csv` is the source of
  truth for which historical Vanguard rows are Roth.
- `data/trades/clean/vanguard_sales/vanguard_sales_2026.csv` gains an `account` column;
  both existing rows are `brokerage`.
- The backdoor Roth CSVs do not need the column; the job stamps it.

### `tax_lots`

One row per slice of a buy lot consumed by a brokerage sell.

| Column | Type | Notes |
|---|---|---|
| `id` | string, PK | `{sell_trade_id}-{n}`, `n` counting slices within that sell from 0. Stable across rebuilds |
| `platform` | string | From the sell |
| `account` | string | From the sell; always `brokerage` in practice |
| `asset` | string | Separate column so rows can be grouped |
| `holding_period` | string | `long_term` or `short_term`, from a `HoldingPeriod` `StrEnum` |
| `description` | string | `"{quantity} {asset}"`, quantity formatted without trailing zeros, the way a 1099-B reads |
| `date_acquired` | date | Buy trade date |
| `date_sold` | date | Sell trade date |
| `quantity` | decimal(18,6) | Shares in this slice |
| `acquisition_price` | decimal(18,6) | Buy trade price |
| `sale_price` | decimal(18,6) | Sell trade price |
| `proceeds` | decimal(18,6) | `(sell.value - sell.fees) * quantity / sell.quantity` |
| `cost` | decimal(18,6) | `(buy.value + buy.fees) * quantity / buy.quantity` |
| `gain_loss` | decimal(18,6) | Postgres generated column, `proceeds - cost`, via SQLAlchemy `Computed` |

Holding period is long-term when `date_sold > date_acquired + 1 year` (held more than one
year), computed with `dateutil.relativedelta` or an equivalent that handles Feb 29.

Fees use `value` and `fees` uniformly rather than each platform's `cost`, because `cost`
means different things per platform (Coinbase folds fees in, IBKR does not). Sell fees
reduce proceeds, buy fees raise cost. For IBKR that is the estimated $0.0035 per share.

## The matcher

New module `backend/backend/lots.py`. One pure function:

```
match_lots(trades: list[models.Trade]) -> LotMatches
```

- Skips excluded trades.
- Groups by `(asset, platform, account)`.
- Within a group, processes trades in `(date, action)` order with BUY before SELL on the
  same date, so a same-day rebuy is never consumed by the sale that funded it.
- BUY appends an open lot holding a reference to the buy trade and its remaining quantity.
- SELL consumes open lots oldest-first, splitting the last lot when the sell lands mid-lot.
  Each consumed piece is recorded as a `LotSlice(buy: Trade, sell: Trade, quantity: Decimal)`.
- If a sell outruns its open lots, raise `UnmatchedSellError` naming the asset, platform,
  account, sell id, and unmatched quantity. Never invent a zero-basis slice. This fails the
  sync loudly rather than writing a wrong gain.

`LotMatches` is a dataclass with `open_lots: dict[str, list[OpenLot]]` keyed by asset (all
accounts merged, since positions are per asset) and `slices: list[LotSlice]` in processing
order.

Today every historical sell matches cleanly under per-account FIFO (verified against prod on
2026-09-18: 13 sells, 0 unmatched).

## Consumers

### Positions

`crud.build_positions_from_trades` keeps its signature. It fetches trades up to `end_date`,
calls `match_lots`, and sums each asset's open lots into quantity, cost, and average price
exactly as today. The only behavior change is per-account pooling; on current data every
position comes out identical (every asset with cross-platform sells was sold out on
2026-09-18).

### Tax lots

New in `crud.py`:

- `build_tax_lots(matches: LotMatches) -> list[models.TaxLot]`: one row per slice whose
  sell is in the brokerage account, with the id, holding period, and prorated proceeds and
  cost from the data model section.
- `store_tax_lots(db, tax_lots)`: delete everything, bulk insert, commit. Mirrors
  `store_positions`.

## Wiring

In `jobs.py`:

- `rebuild_tax_lots(db)`: fetch all trades, `match_lots`, `build_tax_lots`,
  `store_tax_lots`. Logs the row count.
- Called at the end of `index_recent_trades` and `index_backdoor_roth_trades`, right after
  positions are stored.
- New `--tax-lots` flag on the CLI for a manual rebuild, e.g. after a hand-inserted
  Vanguard sale.

In `Makefile`:

- `sync-tax-lots`: runs the job with `--tax-lots`.
- `export-tax-lots`: `psql` copy of `tax_lots` ordered by `date_sold, asset, id` to
  `data/tax_lots.csv`, using `POSTGRES_URL` from `.env`. Data dir is gitignored, same as the
  other CSVs.

## Migration

One-off script `backend/backend/bootstrap/add_trade_accounts.py`, run once against prod,
following the `repair_prices.py` precedent:

1. `ALTER TABLE trades ADD COLUMN account VARCHAR NOT NULL DEFAULT 'brokerage'`, skipped
   if the column exists.
2. `UPDATE trades SET account = 'roth'` for the ids listed in the script. The list is
   built from the Roth account number (`19361123`) in the raw Vanguard export, matched to
   DB rows by asset, quantity, and price (DB dates are settlement dates, one to four days
   later; VO is stored split-adjusted, 12 @ 65.64 for the export's 3 @ 262.56):

   | Export | DB id |
   |---|---|
   | AAAU 2024-02-08, 6 @ 20.12 | vanguard-337 |
   | VB 2024-02-08, 1 @ 211.25 | vanguard-339 |
   | VT 2024-02-08, 2 @ 105.03 | vanguard-343 |
   | AAAU 2025-03-20, 1 @ 29.98 | vanguard-455 |
   | VB 2025-03-20, 5 @ 228.48 | vanguard-456 |
   | VO 2025-03-20, 3 @ 262.56 | vanguard-457 |
   | VOO 2025-03-20, 4 @ 523.65 | vanguard-458 |
   | VT 2025-03-20, 24 @ 118.71 | vanguard-459 |
   | VWO 2025-03-20, 1 @ 46.33 | vanguard-460 |
   | VXUS 2025-03-20, 1 @ 63.96 | vanguard-461 |
   | 2026 backdoor batch | vanguard-491 through vanguard-499 |

3. `models.Base.metadata.create_all` to create `tax_lots`.
4. Print per-asset Roth share totals so they can be eyeballed against the export
   (VT 52.28, AAAU 21, VB 10.32, VOO 6.44, VO 14.36, VWO 5.11, VXUS 3.89, VNQ 2.22).

The same id list is applied to `vanguard_clean.csv`'s new `account` column so seed and
prod agree. `vanguard_clean.csv` lives in the gitignored `data/` dir and is mirrored to the
`portfolio-data` repo.

**Assumption to verify with the user:** the Roth's first buy in the export (2024-02-08) is
also the first day of the export window, so earlier Roth buys could exist in the manual
pre-2024 data with no account marker. If so, they get added to the same id list; nothing
else changes.

## Testing

`backend/tests/test_lots.py`, pure, no DB:

- FIFO consumes the oldest lot first and splits a lot on a partial sell.
- A sell spanning several lots yields one slice per lot with the right quantities.
- Lots are pooled per account and per platform: a Roth lot is never consumed by a
  brokerage sell of the same asset, and an IBKR lot is never consumed by a Vanguard sell.
- Same-day buy and sell: the buy is not consumed by the sell.
- Excluded trades are ignored.
- A sell that outruns its lots raises `UnmatchedSellError` with the unmatched quantity.

`backend/tests/test_tax_lots.py`, pure, builds `TaxLot` rows from `LotMatches`:

- Holding period is short-term at exactly one year and long-term one day later.
- Proceeds and cost prorate fees on both sides; a slice that is half a buy lot carries half
  the buy's fees.
- Roth sells produce no rows.
- Ids are `{sell_id}-0`, `{sell_id}-1`, … within a sell.

`backend/tests/test_positions.py`, pure, calls the position aggregation on `LotMatches`:

- Quantity, cost, and average price sum across accounts for one asset.
- An asset fully sold out produces no position.

The job wiring and migration script are exercised by running them, not by unit tests; the
rebuild after migration must report 13 sells' worth of slices with no unmatched error, and
`positions` must be byte-identical to before the migration for every asset.

## Out of scope

- Wash-sale adjustments.
- Specific-lot overrides.
- Splitting positions rows per account.
- The backdoor Roth job's lack of idempotency (re-running it re-inserts every CSV row
  under new ids). Known, unchanged here.
- Reinvested dividends at Vanguard, which the DB does not track.

## Build plan

### Chunk 1: matcher, accounts, positions

Depends on: none.

Files: `backend/backend/lots.py` (new), `backend/backend/database/models.py`,
`backend/backend/database/crud.py`, `backend/tests/test_lots.py` (new),
`backend/tests/test_positions.py` (new).

- Add `TradeAccount` and `HoldingPeriod` enums and the `account` column to `Trade`.
- Add the `TaxLot` model with the `Computed` `gain_loss` column.
- Implement `match_lots`, `LotMatches`, `OpenLot`, `LotSlice`, `UnmatchedSellError`.
- Refactor `build_positions_from_trades` to aggregate `match_lots` output; extract the
  aggregation into a pure `positions_from_matches(matches) -> list[Position]` so it can be
  tested without a DB.
- Tests: `test_lots.py`, `test_positions.py` as listed above.

Interfaces produced: `lots.match_lots`, `LotMatches`, `LotSlice`, `models.TaxLot`,
`models.TradeAccount`, `crud.positions_from_matches`.

### Chunk 2: tax lot rows, wiring, migration, data

Depends on: chunk 1.

Files: `backend/backend/database/crud.py`, `backend/backend/jobs/jobs.py`,
`backend/backend/scrapers/trades.py`, `backend/backend/bootstrap/add_trade_accounts.py`
(new), `backend/backend/bootstrap/seed.py`, `Makefile`, `README.md`,
`backend/tests/test_tax_lots.py` (new), and the CSVs under `data/trades/clean/`.

- `build_tax_lots`, `store_tax_lots` in `crud.py`.
- `rebuild_tax_lots` in `jobs.py`, called from both index jobs, plus the `--tax-lots` flag.
- Scrapers stamp `account=brokerage`; the backdoor job stamps `roth`.
- `seed.py` reads the `account` column from the clean CSVs.
- Migration script as specified. Add the `account` column to `vanguard_clean.csv`,
  `coinbase_clean.csv`, and `vanguard_sales_2026.csv`, tagging the Roth ids.
- Makefile targets `sync-tax-lots` and `export-tax-lots`.
- README: describe the table, the export target, and add `account` to the manual Vanguard
  sale instructions.
- Tests: `test_tax_lots.py` as listed above.
