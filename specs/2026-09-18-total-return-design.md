# Total Return on the Portfolio Page

## Problem

The portfolio page's return figure and the asset page's holdings table disagree. The
portfolio page shows unrealized gain over the remaining FIFO cost basis of open lots
(`(value - cost) / cost`, where `cost` is the backend position's remaining basis). The
asset page shows realized plus unrealized gain over net cash invested, computed by its
own FIFO replay. They only agree for an asset that has never been sold. Fully sold
assets (COIN, GLXY, HOOD today, about -$1,178 net realized) are dropped from positions
entirely, so their result vanishes from every portfolio total.

The user's mental model: "if I liquidated everything right now, what is my total return
across all my trades". That is cash out over cash in.

## Definitions

For an asset, or for the whole portfolio, over non-excluded trades:

- `buys` = sum of `Trade.cost` for BUY trades. `Trade.cost` is the real cash that moved,
  net of fees, on every platform (IBKR `|amt|`, Coinbase `total_value_after_fees`).
- `sells` = sum of `Trade.cost` for SELL trades (net proceeds).
- `value` = current quantity times current price (0 for a fully sold asset).
- `total_return` = `value + sells - buys`.
- `returns` (percent) = `total_return / buys * 100`, and `0` when `buys == 0`.

Portfolio totals are the sums of the per-asset figures; the portfolio percent is the
summed `total_return` over summed `buys`. The existing `cost`, `average_price`, and
`average_position_price` fields keep their meaning (remaining FIFO cost basis and its
per-unit average) and stay in the API.

## Backend

No schema change. No backfill.

### Position builder (`crud.build_positions_from_trades`)

Stop skipping assets whose remaining quantity is zero. Emit a `Position` for them with
`quantity = 0`, `cost = 0`, `average_price = 0`. Assets with no trades still produce no
row. `crud.build_historical_positions` skips zero-quantity positions before enriching,
so the `historical_positions` table is unchanged (its per-asset `returns` column keeps
its old unrealized meaning; nothing reads it through the API).

### Cash flow query (`crud`)

Two new functions, both over `Trade` rows with `excluded = false`:

- `get_cash_flows(db, assets=None) -> dict[str, CashFlow]`: per asset, `buys` and
  `sells` totals. `CashFlow` is a small dataclass with `buys: Decimal` and
  `sells: Decimal`. Optional asset filter.
- `get_daily_cash_flows(db, assets=None) -> list[DailyCashFlow]`: per trade date,
  ordered ascending, `date`, `buys`, `sells` for that day (not cumulative). Optional
  asset filter.

### Positions endpoint (`transforms.get_enriched_positions`, `schemas.Position`)

`schemas.Position` gains `buys: Decimal`, `sells: Decimal`, `total_return: Decimal`.
`returns` is redefined per Definitions. Positions with `quantity == 0` are included;
their `current_allocation` is 0. The live price lookup covers every configured asset,
so an exited asset still resolves a price (its value is 0 regardless).

### Performance endpoint (`transforms.get_performance`, `schemas.Performance`)

`schemas.Performance` gains `buys: Decimal` and `sells: Decimal`; `returns` is
redefined per Definitions; `cost` stays. Implementation: keep the existing per-date
`sum(cost)`, `sum(value)` query over `historical_positions` (with the duration window
and asset filter). Separately fetch `get_daily_cash_flows` with the same asset filter
and no date window. Walk the history dates in order, advancing through the daily cash
flows and accumulating running `buys` and `sells` for every trade date `<= ` the history
date. A trade made on a date is included in that date's figure, matching how the
position snapshot for that date already includes that day's trades. Because the cash
flows are fetched without a window, a duration window that starts after some trades
still gets the correct cumulative totals.

## Mobile app (`frontend/mobile`)

- `Asset` gains `buys`, `sells`, `total_return` (strings, like the other fields).
  `PerformanceData` gains `buys`, `sells`.
- `calculatePortfolioSummary`: `totalReturn = sum(total_return)`,
  `totalReturnPercent = totalReturn / sum(buys) * 100` (0 when buys is 0). `totalCost`
  stays as the sum of `cost`.
- `PortfolioScreen` selected data point: `totalReturn = value + sells - buys`,
  `totalReturnPercent = returns`.
- `TotalWorthChart`: line color follows the sign of the latest point's `returns`.
- `AssetRow`: dollar figure is `asset.total_return`, percent is `asset.returns`.
  `AssetList` gain sorts use `total_return`.
- `AssetList`: split filtered assets into open (`quantity > 0`) and closed
  (`quantity == 0`). Open rows render as today. Closed rows render under a
  "Closed positions" header at the bottom of the list, collapsed by default, with a
  chevron and a count in the header. Closed rows use the same `AssetRow` (so they show
  $0.00 value and the realized result) and remain tappable to the asset page. The
  section is omitted when there are no closed positions.
- `AllocationsScreen`: drop `quantity == 0` positions before `aggregateAssetsByMarket`
  and the segment aggregation, so no $0 rows appear on the allocation screens.
- Asset page `assetService.calculateHoldings`: every cash figure uses the trade's `cost`
  (real cash) instead of `quantity * price`. Buy lots carry `costBasis = trade.cost`
  and a per-unit price of `cost / quantity`; sells count `trade.cost` as proceeds.
  `totalBuys` and `totalSellProceeds` become sums of `trade.cost`.
  `totalReturn = currentValue + totalSellProceeds - totalBuys`,
  `totalReturnPercent = totalReturn / totalBuys * 100` (0 when totalBuys is 0).
  Realized and unrealized keep their FIFO definitions and now sum exactly to
  `totalReturn`. `AssetHoldings` gains `totalBuys` so `AssetHoldingsSummary` can divide
  the realized and unrealized percents in the expanded breakdown by `totalBuys` instead
  of `|netInvested|`. `netInvested` (buys minus sells) is still displayed as before.
- Demo mock data (`mockData.ts`, `mockAssetData.ts` if it carries positions or
  performance rows) gains the new fields with internally consistent values, including
  one closed position so the collapsible section is exercised in demo mode.

## Desktop Streamlit app (`frontend/desktop/main.py`)

Summary totals use `total_return` and `buys`: "Total Invested" is the sum of `buys`,
the return dollar is the sum of `total_return`, the return percent is that over the sum
of `buys`. Per-asset table columns keep `cost` and show `returns` as delivered by the API.

## Repo

Add `.gtrconfig` at the repo root so new worktrees copy `.env*` and run `make install`:

```ini
[copy]
include = .env*

[hooks]
postCreate = make install
```

## Rollout

Deploy is push-to-main. After deploy the positions table is rebuilt on the next trade
sync (or `make sync-positions`), which is when exited assets first appear. The
performance endpoint is correct immediately since it reads trades directly. The open
PR #27 (IBKR sell quantity sign) touches the position builder; rebase this branch onto
main once it merges.

## Testing

Backend (pytest, in-memory SQLite session built from `models.Base`):

- `build_positions_from_trades` emits a zero-quantity row for a fully sold asset and no
  row for an asset with no trades; `build_historical_positions` skips it.
- `get_cash_flows` and `get_daily_cash_flows` sum `cost` by action, ignore excluded
  trades, and honor the asset filter.
- `get_performance` running totals: a trade before the duration window is included in
  every point; a trade on a history date is included on that date; asset filter applies
  to both sides; `returns` is 0 when `buys` is 0.
- `get_enriched_positions` returns `buys`, `sells`, `total_return`, `returns` per
  Definitions, including for a zero-quantity position.

Mobile: `npx tsc --noEmit` in `frontend/mobile`. Manual check against the positions
endpoint on prod after deploy and a positions sync: COIN `total_return` about -1849,
HOOD about +739, and the portfolio headline equals the sum of the rows.

## Build plan

### Chunk 1: Backend and repo config

Depends on: none.

Files: `backend/backend/database/crud.py`, `backend/backend/router/schemas.py`,
`backend/backend/router/transforms.py`, new `backend/tests/test_positions.py`,
`backend/tests/test_performance.py` (or one file), `.gtrconfig`.

Produces: the API shape in Definitions (`Position` + `buys`/`sells`/`total_return`,
`Performance` + `buys`/`sells`, `returns` redefined on both).

Key decisions: `CashFlow` and `DailyCashFlow` dataclasses live in `crud.py`. The
running-total walk lives in `transforms.get_performance`; keep it a small helper so the
test can drive it with lists. Zero-quantity positions are skipped in
`build_historical_positions`, not in the enricher.

Tests: as listed under Testing, backend section. Add a `conftest.py` with an in-memory
SQLite session fixture if none exists.

### Chunk 2: Mobile portfolio page and allocations

Depends on: none (builds against the API shape in Definitions; can run in parallel
with chunk 1).

Files: `frontend/mobile/src/data/types.ts`, `frontend/mobile/src/data/utils.ts`,
`frontend/mobile/src/screens/PortfolioScreen.tsx`,
`frontend/mobile/src/screens/AllocationsScreen.tsx`,
`frontend/mobile/src/components/TotalWorthChart.tsx`,
`frontend/mobile/src/components/AssetRow.tsx`,
`frontend/mobile/src/components/AssetList.tsx`,
`frontend/mobile/src/data/mockData.ts`.

Key decisions: closed section state is local `useState(false)` in `AssetList`; header
styled like the existing sort header row, using the existing chevron icon from
`lucide-react-native`. `isFirst`/`isLast` rounding is computed per group.

Tests: `npx tsc --noEmit`.

### Chunk 3: Asset page holdings and desktop app

Depends on: none.

Files: `frontend/mobile/src/services/assetService.ts`,
`frontend/mobile/src/data/assetTypes.ts` (`AssetHoldings.totalBuys`),
`frontend/mobile/src/components/AssetHoldingsSummary.tsx` (breakdown percents),
`frontend/mobile/src/data/mockAssetData.ts` if its trades need `cost` values,
`frontend/desktop/main.py`.

Key decisions: lot cost basis is `trade.cost`; a lot's per-unit price is
`cost / quantity` so partial FIFO sells consume basis proportionally.

Tests: `npx tsc --noEmit`; hand-check one asset with a partial sell in the app.
