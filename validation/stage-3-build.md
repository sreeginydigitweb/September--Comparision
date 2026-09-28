# Validation — Stage 3: Build

Run 2026-09-28. Result: **PASS**.

## Build status

Dashboard built and serving on localhost. 17,845 rows.

| | |
|---|---|
| Start command | `npm start` (from the project root) |
| Local URL | `http://localhost:3000` |
| Validate command | `npm run validate` |
| Dependencies installed | **none** — Node built-ins only |

## Dataset

| | |
|---|---|
| Rows | 17,845 |
| Grain | Account + eBay item_id + marketplace (verified unique) |
| Accounts | 22 eBay sub_sources |
| Currencies | GBP 8,942 · EUR 5,277 · USD 3,626 |
| LY | 2025-09-01 → 2025-09-30 (full) |
| TY | 2026-09-01 → 2026-09-30 (**partial**) — sales & ads to 2026-09-28, traffic to 2026-09-26 |

## Segment counts

| Segment | Rows |
|---|---|
| A — YoY Winner | 1,318 |
| B — YoY Recovery | 93 |
| C — Lost Ad Sales | 77 |
| D — Lost Performer | 1,305 |
| Other | 15,052 |
| **Total** | **17,845** |

`Other` is large because most listings carry traffic but no sales in either September —
correct under the supplied rules, which key A/B/D on sales and C on ad sales.

## Data gates — `node build/validate.mjs`, all PASS

| # | Gate | Result |
|---|---|---|
| 1 | Dataset has rows | PASS — 17,845 |
| 2 | Key unique (account+item+marketplace) — no row multiplication | PASS — 17,845 keys / 17,845 rows |
| 3 | LY/TY sales reconcile per currency | PASS |
| 4 | Ad spend matches the single selected source | PASS — no double-count |
| 5 | No cross-currency totals | PASS — 3 separate buckets |
| 6 | Exactly one valid segment per row | PASS |
| 7 | Segment counts sum to rows | PASS — 17,845 = 17,845 |
| 8 | Every D: LY>0 and TY=0 | PASS — 1,305 rows |
| 9 | Every C: LY ad sales>0, TY ad sales=0, not D | PASS — 77 rows |
| 10 | Every B: TY<LY, recovering, not D/C | PASS — 93 rows |
| 11 | Every A: TY>LY, not D/C/B | PASS — 1,318 rows |
| 12 | No NaN | PASS |
| 13 | No Infinity | PASS |
| 14 | No broken numerics | PASS — every numeric field is number or null |
| 20 | Partial-TY metadata present | PASS |
| — | LY and TY both non-empty | PASS |

## Browser gates — headless test against `http://localhost:3000`

| # | Gate | Result |
|---|---|---|
| 15 | Account filter | PASS — `bestbringer` → 98 of 98 (filtered from 17,845) |
| 16 | Segment filter | PASS — D → 1,305; combined with account → 3, all verified D |
| 17 | Search | PASS — item id → 1 of 1 |
| 18 | Sorting | PASS — LY Views descending then ascending, both correctly ordered |
| 19 | Clear filters | PASS — all controls and sort restored to initial state |
| 20 | Partial-TY notice visible | PASS — renders with both source dates |
| 21 | Loads through localhost | PASS — HTTP 200, 21 columns, 400 rows rendered initially |
| 22 | Console errors | PASS — **0 console errors, 0 failed requests** |
| — | Horizontal scroll usable | PASS — 1,801px table in 1,280px viewport, scrollable |
| — | Result count visible | PASS — "Showing 400 of 17,845 listings" |

Rendering is paged at 400 rows with a **Show more** button; filtering and sorting operate
over the whole 17,845-row dataset, and the count always reports the true filtered total.

## Database safety

`ledsone` — SELECT only, as `dbhub_readonly` (non-superuser; INSERT/UPDATE/DELETE/CREATE
all denied). **Writes performed: NONE.** `order_management_copy` and `analytics.ph_segment`
were not queried. No git commit, push or deployment.

## Known V1 limitations

1. TY September is partial, and sources end on different days (traffic 2026-09-26 vs sales/ads 2026-09-28).
2. Ad Spend is the performance-report figure, not the billing record — the billing record holds only ~3 TY days.
3. Ad Sales under-attribute Promoted Advanced by ~25%.
4. LY/TY Price are realised ASP; no historical list price exists.
5. ASP averages across variations at listing grain.
6. GBP/EUR/USD are never summed together.
7. Segment precedence D→C→B→A is a V1 implementation rule, not business-confirmed.
8. Segment D requires TY Sales exactly 0; near-dead listings fall to Other.
9. Listing Analysis and Demand Analysis absent — no verified LY-vs-TY source.
10. Snapshot only — TY changes on re-run while September is open.
