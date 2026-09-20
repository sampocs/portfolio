# Holdings Card, Closed Positions, and Allocation Targets

## Problem

The asset page's holdings card mixes two questions into four cells: "what do I hold
right now" (owned, market value) and "across every trade, what happened" (net invested,
total gains). PR #32 relabeled Net Invested as Total Invested, which lost the cash-still-
at-risk figure the user wants to keep. Fully sold assets show a Position with zeros, and
dust positions (ETH at $19) render as if they were live holdings on the asset page, the
portfolio list, and the allocation screens.

Separately, the target allocations are being rebalanced: five assets go to 0% and the
Crypto Stocks segment goes away entirely. The allocation screens have no notion of a
zero-target asset and would keep showing them and their empty segment.

## Definitions

All per asset, over non-excluded trades, computed on the client from `/trades/{asset}`
exactly as `assetService.calculateHoldings` does today (trades replayed FIFO in
`(date, BUY before SELL, id)` order):

- `invested` = sum of `trade.cost` over BUY trades (real cash in).
- `sold` = sum of `trade.cost` over SELL trades (real cash out).
- `netInvested` = `invested - sold`. Cash still at risk; negative means more has been
  taken out than put in.
- `costBasis` = FIFO cost of the lots still held. `averagePrice` = `costBasis / owned`.
- `marketValue` = `owned * currentPrice`.
- `unrealized` = `marketValue - costBasis`; `realized` = `sold - basis of lots sold`.
- `totalReturn` = `marketValue + sold - invested` (`= realized + unrealized`). This is
  "if I liquidated the whole position now, what did I make across all my trades".
- `totalReturnPercent` = `totalReturn / invested * 100`, 0 when `invested` is 0.

The portfolio row's dollar figure is the backend `Position.total_return` and its percent
is `Position.returns`, defined identically (`value + sells - buys`, over `buys`). The
asset page and the portfolio row must show the same number for the same asset; the row's
color follows the sign of the dollar figure.

**Closed position.** An asset is closed when `marketValue < CLOSED_POSITION_VALUE_USD`
(`50`, a constant in `frontend/mobile/src/constants/index.ts`). This replaces the
`quantity === 0` test everywhere in the mobile app. A closed asset's dust value still
counts in `totalReturn` and in the portfolio total.

## Mobile app (`frontend/mobile`)

### Holdings card (`AssetHoldingsSummary`, `ExpandableGains`, `assetService`, `assetTypes`)

`AssetHoldings` becomes:

```
owned, averagePrice, costBasis, marketValue, unrealized,
invested, sold, netInvested, realized, totalReturn, totalReturnPercent,
tradeCount, lastSellDate (ISO date string or null)
```

`calculateHoldings` already computes every value; it exposes them under these names
(`totalBuys` → `invested`, `totalSellProceeds` → `sold`, `currentValue` →
`marketValue`, `totalQuantity` → `owned`, `unrealizedGains` → `unrealized`,
`realizedGains` → `realized`). `tradeCount` is the number of trades replayed;
`lastSellDate` is the date of the latest SELL, or null if none.

The card renders two groups inside the existing card container, separated by a 1px
divider, each with a small uppercase header strip (label left, detail right):

**Position** (omitted entirely when the asset is closed)
- Strip: `POSITION` / `<owned> <SYMBOL>` (quantity formatted as today, 4 decimals,
  trailing zeros stripped).
- Two cells: **Cost Basis** `$costBasis` with sub-line `avg $averagePrice`;
  **Market Value** `$marketValue` with sub-line `±$unrealized · ±x.x%` colored by sign,
  where the percent is `unrealized / costBasis * 100` (0 when `costBasis` is 0).

**Lifetime** (always shown)
- Strip: `LIFETIME` / detail. Open asset: `<tradeCount> trades`. Closed asset with
  `owned == 0`: `<tradeCount> trades · sold out <Mon D, YYYY>` using `lastSellDate`.
  Closed asset with dust: `<tradeCount> trades · <owned> <SYMBOL> left ($marketValue)`.
- Four cells in a 2x2 grid: **Invested** `$invested`; **Sold** `$sold`;
  **Net Invested** `$netInvested`, green with sub-line `house money` when negative;
  **Total Gains / Total Losses** via `ExpandableGains` exactly as today (label by sign,
  dollar and percent pill colored by sign, chevron).

Tapping Total Gains expands the existing Realized / Unrealized breakdown below the
grid; each line's percent is over `invested`, as today. `ExpandableGains` keeps its
current props minus the already-removed `netInvested`. The loading skeleton mirrors the
new layout with `---.--` placeholders in every cell and shows both groups.

Percent and currency formatting reuse `formatCurrency` / `formatPercentage` from
`styles/utils`. Colors come from `theme.colors` (`success`, `destructive`, the
`*Background` variants for pills, `muted` for strips and sub-lines).

### Portfolio list (`AssetList`)

The open/closed split uses `parseFloat(asset.value) < CLOSED_POSITION_VALUE_USD`
instead of `quantity === 0`. Nothing else changes: closed rows still render in the
collapsed "Closed positions (N)" section with their dust value and lifetime result.

### Allocation screens (`AllocationsScreen`)

`openPositions` becomes the assets that are not hidden, where an asset is hidden when
`parseFloat(asset.target_allocation) === 0 && parseFloat(asset.value) <
CLOSED_POSITION_VALUE_USD`. A zero-target asset with real money still in it stays
visible, since it still needs selling down. Because aggregation runs over the filtered
list, a segment or market whose every asset is hidden never appears; that is what
removes Crypto Stocks. The `Crypto` market remains through BTC and SOL.

### Segment colors (`data/utils.getSegmentColor`)

Rotate three entries: `Gold` → `#8B5CF6` (was Crypto Stocks), `Real Estate` →
`#AFD4FD` (was Gold), `Crypto Stocks` → `#B35B8A` (was Real Estate). Market colors
are unchanged. Demo mock data is untouched.

## Backend and config

### `assets.yaml` targets

| Asset | Target |
|---|---|
| VT | 35 |
| VOO | 15 |
| VO | 6 |
| VB | 10 |
| VXUS | 2 |
| VWO | 2 |
| BTC | 15 |
| SOL | 5 |
| AAAU | 8 |
| VNQ | 2 |
| ETH, TIA, COIN, HOOD, GLXY | 0 |

Sum is 100. Markets, segments, platforms, and contract ids do not change; zero-target
assets stay configured so their trades, prices, and lifetime results keep flowing.

### Target sum guard (`backend/backend/config.py`)

A module-level helper `validate_target_allocations(assets: list[Asset]) -> None`
asserts the targets sum to exactly `Decimal(100)` with a message that prints the
actual sum. `Config.load_assets` calls it after parsing. The desktop app and every
allocation delta divide by this total implicitly, so a config that sums to 102 must
fail at startup rather than skew every number by 2%.

## Out of scope

The desktop Streamlit app beyond what it inherits from `assets.yaml`. Any change to the
backend positions or performance endpoints. Demo mock data.

## Rollout

This branch is based on `fix-asset-holdings-trade-order` (PR #32) because it rewrites
the same holdings code. Merge #32 first, then this PR into `main`. Push-to-main deploys
the backend, which is when the new targets reach the app. The mobile app needs a new
EAS build (`make build-app`, `make deploy-app` after bumping `app.json`).

## Testing

Backend (pytest): `validate_target_allocations` passes on a list summing to 100 and
raises on 102; the checked-in `assets.yaml` loads without error.

Mobile: `npx tsc --noEmit` reports the same 20 pre-existing errors as `main` and none
in touched files. Hand-check in the simulator with live data: ETH's asset page shows
only the Lifetime group with `… · 0.0075 ETH left ($19.xx)` and Total Losses about
-$977 / -16.24%; GLXY shows `sold out Sep 18, 2026` and -$68.21 / -2.93%; SOL shows
both groups with Net Invested green and `house money`; the portfolio list's Closed
positions section counts ETH and TIA alongside COIN, GLXY, HOOD; the Allocations
segment view has no Crypto Stocks and Gold renders purple.

## Build plan

### Chunk 1: Holdings card and closed rule

Depends on: none.

Files: `frontend/mobile/src/constants/index.ts` (`CLOSED_POSITION_VALUE_USD`),
`frontend/mobile/src/data/assetTypes.ts`, `frontend/mobile/src/services/assetService.ts`,
`frontend/mobile/src/components/AssetHoldingsSummary.tsx`,
`frontend/mobile/src/components/ExpandableGains.tsx` (only if a prop changes),
`frontend/mobile/src/components/AssetList.tsx`, and any caller of `AssetHoldings`
fields that were renamed (grep for `totalBuys`, `currentValue`, `totalQuantity`,
`unrealizedGains`, `realizedGains` under `frontend/mobile/src`).

Produces: the `AssetHoldings` shape in Definitions; the two-group card; the portfolio
list using the value threshold.

Key decisions: the closed test is one exported helper `isClosedPosition(value: number)`
next to the constant, used by `AssetList`, `AllocationsScreen`, and the card, so the
definition lives in one place. Date formatting for `sold out` reuses whatever
`TradeRow` uses for its trade date.

Tests: `npx tsc --noEmit`; simulator hand-check per Testing.

### Chunk 2: Allocations, colors, and targets

Depends on: chunk 1 for `isClosedPosition` (import it; if building in parallel, define
it in chunk 1's file and rebase).

Files: `frontend/mobile/src/screens/AllocationsScreen.tsx`,
`frontend/mobile/src/data/utils.ts` (colors only), `assets.yaml`,
`backend/backend/config.py`, new `backend/tests/test_config.py`.

Produces: hidden zero-target dust assets and empty segments; rotated segment colors;
new targets; the sum guard.

Tests: the two `validate_target_allocations` cases and a load of the real
`assets.yaml`; `npx tsc --noEmit`; simulator check of the Allocations segment view.
