# Trade Custodian and Platform Migration: Design

- **Date:** 2026-09-20
- **Status:** Approved design
- **Branch:** `trade-custodian`
- **Tier:** Medium (brainstorm → spec → lean-build)

## Goal

Let held shares move between platforms without breaking tax lots or losing the record of where
a trade was originally made.

The immediate need is an in-flight transfer from a Vanguard IRA into the Robinhood Roth IRA. A
full IBKR-to-Robinhood migration is likely later.

## Background

Trades are the source of truth: positions and the performance chart derive from them, and
`lots.match_lots` groups by `(asset, platform, account)` so that a sell only consumes lots from the
same platform and account.

That grouping breaks the moment shares move custodians. Shares bought at Vanguard and later sold at
Robinhood would find no lots at `(asset, robinhood, roth)`, because the buys still say `vanguard`.

Rewriting `platform` on those buys would fix the lot matching and break other things: `platform` is
also how each scraper finds its own watermark (`max(date) where platform = 'ibkr'`), so rewriting it
empties the watermark, and the next sync re-fetches the platform's full history.

### Rejected alternatives

| Approach | Why not |
|---|---|
| Record the transfer as a sell at the old platform plus a buy at the new one | Resets cost basis and holding period at the transfer date, turning long-term lots into short-term ones — corrupting the exact thing this design protects. |
| Rewrite `platform` in place | Breaks each scraper's watermark, and loses where the trade actually happened. |
| Detect transfers from the SnapTrade activity feed | Matching a transfer to specific lots is a lot-splitting problem, and it would mutate history unattended from a feed we have never seen. The user knows when their own transfers complete. |

## Design

### 1. `custodian` column on `trades`

`platform` keeps its current meaning: where the trade came from, which is immutable. A new
`custodian` column records where the shares are held now. They are equal for every row until a
transfer happens, and only buys can diverge — a sell always executes where the shares are held, so
`platform == custodian` for sells.

`Platform` gains a `VANGUARD = "vanguard"` member. That value is already on 502 production rows
(the backdoor Roth imports) but was missing from the enum, and the re-platform command validates
against it.

### 2. Migration: `bootstrap/add_trade_custodians.py`

Follows the `add_trade_accounts.py` precedent — a one-off, idempotent script rather than a migration
framework, since the repo has no Alembic:

1. Add `custodian` as nullable if it does not already exist.
2. Backfill `custodian = platform` for every row.
3. Set the column `not null`.
4. Print share totals grouped by `(custodian, account)` to eyeball against the previous shape:
   `coinbase/brokerage`, `ibkr/brokerage`, `robinhood/brokerage`, `vanguard/brokerage`,
   `vanguard/roth`.

### 3. Scrapers set `custodian = platform`

Every scraper (IBKR, Coinbase, Robinhood) and the backdoor Roth CSV import set `custodian` equal to
their own platform on new trades. A scraper only ever sees trades at their original home.

### 4. `store_trades` never overwrites a stored custodian

`crud.store_trades` uses `db.merge`, which replaces every column. Each scraper re-fetches a rolling
window and rebuilds those trades with `custodian = platform`, so a re-platformed trade still inside
that window would have its custodian silently reverted on the next sync.

Before merging, `store_trades` carries an existing row's custodian forward. Scrapers know nothing
about transfers, so they must not be able to undo one. This protects every platform, not just IBKR.

### 5. `lots.match_lots` groups by custodian

The grouping key becomes `(asset, custodian, account)`. This is the change that lets a Robinhood sell
consume Vanguard-bought lots now held at Robinhood, with their original cost basis and acquisition
dates intact. `SellWithoutLots` messages name the custodian.

`tax_lots` rows keep carrying `platform` as they do today, since `platform == custodian` for sells.
`crud.build_positions_from_trades` groups by asset only, so positions and the performance chart are
untouched — a transfer changes no totals, and no snapshot rebuild is needed.

### 6. Re-platform command: `bootstrap/replatform.py`

`make replatform FROM=vanguard TO=robinhood ACCOUNT=roth [ASSET=VT] [EXECUTE=1]`

Mechanically one statement — `update trades set custodian = :to where custodian = :from` plus the
optional account and asset filters. Details that matter:

- **No action filter.** Buys and sells both move. Updating only buys would strand the old
  custodian's sells without lots, and `match_lots` would raise on them. Moving every row replays the
  identical FIFO at the new custodian.
- **Dry run by default.** Prints each affected row (date, asset, action, quantity, price) and
  per-asset share totals. `EXECUTE=1` commits.
- **Validates both platform values** against the `Platform` enum, and reports when the filter
  matches nothing rather than silently succeeding.
- **Merging into an occupied custodian is allowed.** Already holding VT at Robinhood and transferring
  more in is normal; FIFO across the combined history is correct.
- **Rebuilds tax lots after committing** and reports unmatched sells.

### 7. Sync disable switch

`DISABLED_SYNC_PLATFORMS` (comma-separated, empty by default) lists platforms whose scrape
`index_recent_trades` skips, with an info log naming the skip. Kept so IBKR can be switched off on
migration day without a code change, and switched back on if that turns out premature.

The "seed the DB first" assert is left alone: disabling a platform does not remove its rows.

## Non-goals

- **Partial transfers.** Moving only some shares of a position means choosing which lots moved. The
  command moves whole `(custodian, account)` groups, optionally narrowed by asset, and does not
  support a quantity.
- Detecting transfers automatically, deleting IBKR code, changes to positions, snapshots, the API, or
  the mobile app.

## Error handling

| Situation | Behavior |
|---|---|
| Unknown platform passed to the command | Refused, listing valid values |
| Filter matches no rows | Reported as a no-op, exit without committing |
| Command run without `EXECUTE=1` | Prints the plan, changes nothing |
| Migration script run twice | Column add is skipped; the backfill is idempotent |
| Sell with no lots at its custodian after a move | Surfaced by the post-move tax-lot rebuild |
| Disabled platform in `DISABLED_SYNC_PLATFORMS` | Scrape skipped, other platforms unaffected |

## Testing

- `store_trades` carries a stored custodian forward when a scraper re-upserts the same trade id, and
  sets it for genuinely new rows.
- `lots.match_lots`: a sell consumes a transferred lot at the new custodian; it still refuses to
  consume a lot at a different custodian; a long-term holding period survives the move.
- Re-platform: a dry run mutates nothing; execute moves every row in the group including sells; the
  asset filter narrows correctly; an unknown platform is refused; an empty match is a no-op.
- The disable switch skips only the named platform's scraper.
- The migration script is verified by running it against production and eyeballing the printed
  totals, as `add_trade_accounts.py` was.

---

## Build plan

### Chunk 1: custodian column, backfill, and the upsert rule

**Files:** `backend/backend/database/models.py`, `backend/backend/config.py`,
`backend/backend/database/crud.py`, `backend/backend/scrapers/trades.py`,
`backend/backend/jobs/jobs.py`, `backend/backend/bootstrap/add_trade_custodians.py` (new),
`backend/tests/factories.py`, `backend/tests/test_store_trades.py` (new)

**Produces:** `Trade.custodian`; `Platform.VANGUARD`; `store_trades` preserving a stored custodian;
all four trade builders setting `custodian`.

**Decisions:** add the column nullable, backfill, then set `not null` — there is no sensible single
default. `factories.make_trade` gains a `custodian` default so existing tests keep passing.

**Tests:** custodian preserved on re-upsert; set on insert; each builder sets it equal to its platform.

**Depends on:** none.

### Chunk 2: lot matching by custodian

**Files:** `backend/backend/lots.py`, `backend/tests/test_lots.py`, `backend/tests/test_tax_lots.py`

**Consumes:** `Trade.custodian` from chunk 1.

**Produces:** grouping on `(asset, custodian, account)`; `SellWithoutLots` naming the custodian.

**Tests:** a sell consumes a transferred lot at its custodian; cross-custodian isolation still holds;
holding period survives a move; existing lot tests still pass with custodian set.

**Depends on:** chunk 1.

### Chunk 3: re-platform command and sync disable switch

**Files:** `backend/backend/bootstrap/replatform.py` (new), `backend/backend/config.py`,
`backend/backend/jobs/jobs.py`, `Makefile`, `.env.template`, `README.md`,
`backend/tests/test_replatform.py` (new), `backend/tests/test_jobs_sync_toggle.py` (new)

**Consumes:** `Trade.custodian` and `Platform.VANGUARD` from chunk 1; calls `jobs.rebuild_tax_lots`.

**Produces:** the `replatform` CLI plus `make replatform`; `config.disabled_sync_platforms` and the
skip in `index_recent_trades`.

**Decisions:** dry run is the default; the whole group moves; validation rejects unknown platforms.

**Tests:** as listed under Testing for the command and the switch.

**Depends on:** chunk 1. Independent of chunk 2 — they build in parallel.
