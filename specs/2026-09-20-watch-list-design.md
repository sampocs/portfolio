# Watch List Tab and Portfolio-Mode Asset Page

## Summary

Add a leftmost "Watch List" tab to the mobile app that lists every configured asset with a
non-zero target allocation, showing the current price and the price change over a selected
duration. Tapping a card opens the existing asset page in its current form (price mode).
Opening an asset from the Portfolio tab instead shows the asset page in a new portfolio
mode: the current value of the holding, the holding's value over time as the chart, and a
gain figure that is net of cash flows over the selected window. Holdings and trades
sections are unchanged in both modes. The app still opens on the Portfolio tab.

## Decisions already made

- Watch list assets are the assets in `assets.yaml` with `target_allocation > 0` (TIA is
  excluded today). The backend applies the filter so editing the yaml is all it takes.
- Portfolio-mode delta is **gain net of cash flows** (option B in the brainstorm):
  - `gain = value_end + (sells_end - sells_start) - (buys_end - buys_start) - value_start`
  - `percent = gain / (value_start + (buys_end - buys_start)) * 100`, and `0` when the
    base is `0`.
  - `buys`/`sells` are cumulative cash through a date, using `Trade.cost` over
    non-excluded trades (same definition as the performance endpoint).
- Watch list durations are the portfolio set: `1W, 1M, YTD, 1Y, 5Y, ALL`, default `1Y`.
- The asset page keeps its existing duration toggle (`1D, 1W, 1M, YTD, 1Y, 5Y`) in both
  modes.
- Watch list sort options: Alphabetical (default), Highest Change, Lowest Change. Change
  sorts use the selected duration.

## Backend

### Durations (`config.py`)

- Add `ASSET_DURATIONS = ["1D", "1W", "1M", "YTD", "1Y", "5Y"]` and `"1D":
  datetime.timedelta(days=1)` to `DURATION_TO_TIMEDELTA`. `VALID_DURATIONS` is unchanged so
  the portfolio performance endpoint keeps rejecting `1D`.
- Add `Config.watchlist_assets -> list[str]`: asset ids whose `target_allocation > 0`, in
  yaml order.
- Add a helper `window_start_date(duration: str, today: datetime.date) -> datetime.date |
  None` (module level in `config.py` or `transforms.py`, implementer's call, but one
  place): `YTD` is Jan 1 of `today`'s year, `ALL` is `None`, anything else is `today -
  DURATION_TO_TIMEDELTA[duration]`. No 2-day buffer, unlike `get_performance`, because the
  asset endpoint needs an exact baseline date.

### `GET /watchlist` (`transforms.get_watchlist`, `schemas.WatchlistAsset`)

Response: a list, in yaml order, of

```
{ asset, description, market, current_price,
  changes: { "1W": pct, "1M": pct, "YTD": pct, "1Y": pct, "5Y": pct, "ALL": pct } }
```

- `current_price` comes from `prices.get_cached_asset_prices(db)` (5-minute TTL cache).
- For each duration, the reference close is the `HistoricalPrice` row with the greatest
  `date <= window_start_date`; for `ALL` it is the earliest stored row. `pct =
  (current_price - reference) / reference * 100`. When no reference row exists, or the
  reference is `0`, `pct` is `0`.
- New crud helpers: `get_close_price_on_or_before(db, asset, date) -> Decimal | None` and
  `get_earliest_close_price(db, asset) -> Decimal | None`.
- Auth: `verify_token`, like every other route.

### `GET /positions/{asset}/performance/{duration}` (`transforms.get_asset_performance`, `schemas.AssetPerformance`)

Response:

```
{ start_date, start_value, start_buys, start_sells,
  history: [{ date, value, buys, sells }] }
```

- `duration` must be in `ASSET_DURATIONS`, `asset` must be configured; otherwise 400 (use
  `raise HTTPException`, not `return HTTPException`).
- `start_date = window_start_date(duration, today)`, clamped forward to
  `latest_built_date = db.query(func.max(HistoricalPosition.date)).scalar()` when that
  date exists and is earlier than the raw window start. `HistoricalPosition` rows are
  only built through `last_price_date` by the daily 05:00 America/Chicago job, so
  without the clamp a `1D` request made before that job runs (or on a day it fails)
  would fall back to `start_value = 0` and an empty `history`.
- `start_value` is the `value` of the `HistoricalPosition` row for `(asset, start_date)`,
  or `0` when there is no row. Rows exist for every calendar day an asset is held, so a
  missing row means the asset was not held on that date.
- `start_buys`/`start_sells` are cumulative cash flows through `start_date` inclusive,
  computed from `crud.get_daily_cash_flows(db, assets=[asset])` with
  `_accumulate_running_cash_flows(dates=[start_date], ...)`. They do not depend on rows.
- `history` is every `HistoricalPosition` row for the asset with `date >= start_date`,
  ascending, each with cumulative `buys`/`sells` through its date (same accumulate helper
  over the row dates). The `start_date` row itself is the first point when it exists.
- Gain is not computed server-side. The mobile app owns the formula so the same function
  covers history rows, the scrubbed point, and the live point.

### Tests (`backend/tests`)

- Watch list: an asset with `target_allocation = 0` is omitted; percent math for `1Y`
  against seeded closes; `ALL` uses the earliest close; a missing reference yields `0`.
- Asset performance: `start_value` is `0` and `start_buys` is `0` for an asset first bought
  inside the window; `start_value` matches the row and `start_buys` includes trades on the
  start date; a fully sold asset returns history that ends on its last held day; `1D` is
  accepted here and still rejected by `/performance/{duration}`.
- Follow `tests/factories.py` and existing route tests for setup.

## Mobile app (`frontend/mobile`)

### Types and API (`data/types.ts`, `services/api.ts`)

- `WatchlistAsset { asset, description, market, current_price: string, changes: Record<PortfolioDuration, string> }`
- `AssetPerformancePoint { date, value, buys, sells }` (strings) and
  `AssetPerformance { start_date, start_value, start_buys, start_sells, history: AssetPerformancePoint[] }`
- `apiService.getWatchlist()` and `apiService.getAssetPerformance(symbol, duration)`.

### Navigation (`App.tsx`)

- New `WatchListStack` with `WatchListMain` and `AssetDetail` screens, mirroring
  `PortfolioStack`, so back returns to the watch list.
- Tabs in order: `Watch List` (lucide `Eye` icon), `Portfolio`, `Allocations`, with
  `initialRouteName="Portfolio"`.
- `AssetDetail` route params gain `mode: 'price' | 'portfolio'`. The watch list passes
  `price`, `PortfolioScreen.handleAssetPress` passes `portfolio`.

### Watch list screen (`screens/WatchListScreen.tsx`)

- Header "Watch List" styled like the portfolio header (no long-press behaviour).
- `ScrollView` with `RefreshControl`, then `PortfolioDurationSelector` (default `1Y`), then
  a sort dropdown right-aligned, then the card list.
- Data: in live mode fetch `/watchlist` on mount and on pull-to-refresh, keep it in local
  state (no context change). In demo mode use `mockWatchlist`. Show
  `SkeletonLoadingScreen` while the first load is in flight.
- Switching durations is purely local (all percents are in the response).

### Watch list row (`components/WatchListRow.tsx`)

Same card styling as `AssetRow` (logo from `assetRegistry`, first/last rounding,
separators). Left: ticker bold, description muted underneath. Right: `$` current price bold,
and underneath only the percent chip (success/destructive colours by sign, `+`/`-` prefix,
two decimals). No dollar delta. `onPress` navigates to `AssetDetail` with `mode: 'price'`.

### Sort dropdown (`components/SortDropdown.tsx`)

Generalise: accept an `options: { value: T; label: string }[]` prop and make the component
generic over `T extends string`. `AssetList` passes today's list unchanged. The watch list
passes `alphabetical`, `highest-change`, `lowest-change`.

### Asset page portfolio mode (`screens/AssetDetailScreen.tsx`, `services/assetService.ts`)

- `AssetService.computeWindowGain(point: { value, buys, sells }, baseline: { start_value,
  start_buys, start_sells }) -> AssetPriceChange` implements the formula in Decisions.
  Returns `{ currentPrice: value, previousPrice: start_value, changeAmount: gain,
  changePercent, isPositive: gain >= 0 }` so `AssetPriceHeader` renders it unchanged.
- `AssetService.getAssetPortfolioDetails(symbol, duration, dataMode, position: Asset)`:
  fetches prices, trades, and asset performance in parallel (prices are still needed for
  holdings and `updated_at`). Builds `processedValueData: ProcessedPriceData[]` from
  `history` (date, value) with a final live point `{ date: today, value:
  parseFloat(position.value) }`. Computes `priceChange` for the live point with
  `computeWindowGain({ value: position.value, buys: position.buys, sells: position.sells },
  baseline)`. Holdings and trades are computed exactly as in `getAssetDetails`.
- The screen reads `mode` from route params and the matching position from `useData()`
  (`positions.find(p => p.asset === symbol)`). In portfolio mode it calls
  `getAssetPortfolioDetails`; otherwise it calls `getAssetDetails` and nothing else changes.
- Scrubbing in portfolio mode: the selected point's gain is
  `computeWindowGain(selectedHistoryPoint, baseline)`, so the chart point must carry its
  `buys`/`sells` (put the `AssetPerformancePoint` in `originalData`). For the live point,
  use the position's all-time `buys`/`sells`.
- The header label stays the asset description. The chart's `isPositive` uses the live
  point's gain.
- Remove the duplicated `assetImages` maps in `AssetDetailScreen` and `AssetPriceHeader` in
  favour of `getAssetLogo` while touching these files (the copies are missing GLXY and TIA).

### Demo mode (`data/mockData.ts`, `data/mockAssetData.ts`)

- `mockWatchlist: WatchlistAsset[]` derived from `mockPositions` with `target_allocation >
  0`, using fixed hand-written percent changes per duration.
- `getAssetPerformanceData(symbol, duration)` builds an `AssetPerformance` from
  `mockAssetPriceData[symbol]` times the mock position's quantity, with `start_value` equal
  to the first in-window value and `buys`/`sells` constant, so demo gain equals raw value
  change.

### Verification without a mobile test runner

The reviewer checks `computeWindowGain` by hand against these production figures (window
2025-09-19 to 2026-09-19):

| Asset | start_value | buys in window | sells in window | value_end | gain | percent |
|---|---|---|---|---|---|---|
| VT | 178,885.50 | 4,200.49 | 0 | 211,102.43 | +28,016.43 | +15.30% |
| HOOD | 3,837.81 | 1,509.99 | 5,460.12 | 0 | +112.32 | +2.10% |
| SOL (ALL) | 0 | 5,649.91 | 5,989.03 | 5,102.37 | +5,441.49 | +96.31% |

`npx tsc --noEmit` in `frontend/mobile` must pass.

## Build plan

All chunks are built sequentially on the `watchlist` branch in this working tree, since
chunks 2 and 3 both edit `api.ts`, `types.ts`, and the mock data files.

### Chunk 1: Backend endpoints

- Files: `backend/backend/config.py`, `database/crud.py`, `router/schemas.py`,
  `router/transforms.py`, `router/routes.py`, new `tests/test_watchlist.py`,
  `tests/test_asset_performance.py`.
- Produces: `/watchlist` and `/positions/{asset}/performance/{duration}` with the shapes
  above.
- Key decisions: baseline value is the row on the start date or zero; cash-flow baseline is
  trade-derived; gain is client-side.
- Tests: listed under Backend > Tests. Run `make test`.
- Depends on: none.

### Chunk 2: Watch List tab

- Files: `App.tsx`, new `screens/WatchListScreen.tsx`, new `components/WatchListRow.tsx`,
  `components/SortDropdown.tsx`, `components/AssetList.tsx` (pass options), `data/types.ts`,
  `services/api.ts`, `data/mockData.ts`.
- Produces: the tab, the screen, the generic sort dropdown, `getWatchlist`, `mockWatchlist`.
  Navigates to `AssetDetail` with `mode: 'price'`.
- Tests: `npx tsc --noEmit`; reviewer walks the screen against this spec.
- Depends on: none (uses the response shape from chunk 1 by contract).

### Chunk 3: Portfolio-mode asset page

- Files: `screens/AssetDetailScreen.tsx`, `screens/PortfolioScreen.tsx` (pass `mode`),
  `services/assetService.ts`, `components/AssetPriceHeader.tsx` (logo map removal),
  `data/types.ts`, `data/assetTypes.ts`, `services/api.ts`, `data/mockAssetData.ts`.
- Produces: `computeWindowGain`, `getAssetPortfolioDetails`, `getAssetPerformance`, the
  mode switch on the screen, mock performance data.
- Key decision: the header component is reused as-is by mapping value/gain onto
  `AssetPriceChange`.
- Tests: `npx tsc --noEmit`; reviewer verifies the gain table above by hand.
- Depends on: chunk 2 (route param `mode` and the `AssetDetail` screen in both stacks).
