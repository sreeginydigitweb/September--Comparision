# Validation — Sales-Only Scope Correction (2026-09-29)

Supersedes the population established in `validation/stage-3-build.md` and
`validation/final-validation.md`. Everything else in those records still stands: metric
formulas, row grain, currency separation and the Ad Spend source decision were not
touched.

## What was wrong

V1 built the dashboard population from a `FULL OUTER` merge of identity, sales, traffic and
ads (`documentation/build-plan-v1.md` §F). An eBay id that existed only in a listing, a
traffic row or an ad record therefore appeared as a dashboard row with zero sales. The
senior's feedback — *"athila ellarda ID m varuthu"*, all the IDs are turning up — is that
fault, and the clarified requirement is **the sales view report for September 2025 and
September 2026 only**.

## What changed

| | |
|---|---|
| Population | Built from September **sales** only: `COALESCE(ly_sales,0) > 0 OR COALESCE(ty_sales,0) > 0` |
| Traffic / ads / identity | `LEFT JOIN` enrichment onto that population — cannot add a row |
| Query | `sql/f-combined-sales-driven.sql` (new); the V1 pack F merge is retired |
| Grain | **unchanged** — `Account + eBay item_id + marketplace` |
| Formulas, currency rules, Ad Spend source | **unchanged** |
| Segments | **recalculated** from the corrected population; V1 counts discarded |
| Hard-coded counts | **removed** from `build/standalone.mjs`; expectations now derived |

## Test results

| # | Test | Result | Evidence |
|---|---|---|---|
| 1 | **Date scope** — only Sept 2025 / Sept 2026 contribute to sales | **PASS** | 2 distinct year-months; 0 source rows outside September; 0 outside 2025/2026; LY 09-01→09-30, TY 09-01→09-29. Gate 17 |
| 2 | **Sales population** — every row has LY > 0 or TY > 0 | **PASS** | 3,134 / 3,134 qualified, 0 failures. Gate 15 |
| 3 | **All-ID problem removed** — no row with LY = 0 AND TY = 0 | **PASS** | 0 rows. Gate 16. 14,711 zero-sales rows removed |
| 4 | **Grain** — account + item_id + marketplace unique | **PASS** | 3,134 keys / 3,134 rows. Gate 2; also proven at source (3,134 in → 3,134 out) |
| 5 | **Sales reconciliation** vs direct September aggregation | **PASS** | GBP 2,250 / 92,129.93 / 77,163.45 · EUR 831 / 43,759.15 / 25,007.78 · USD 53 / 1,985.20 / 2,625.00 — exact. Gates 3, 18 |
| 6 | **Enrichment** adds no rows | **PASS** | 3,107 rows enriched with views, 0 unqualified rows present. Gate 19; join test 3,134 → 3,134 |
| 7 | **Segment** — exactly one per row, counts sum | **PASS** | 1,349 + 80 + 77 + 1,296 + 332 = 3,134. Gates 6–11 |
| 8 | **Currency** — GBP/EUR/USD never blended | **PASS** | 3 buckets, per-currency totals only. Gate 5 |
| 9 | **Numeric safety** — no NaN / Infinity | **PASS** | Gates 12–14; 0 non-finite values in the browser check |
| 10 | **Dashboard** — account, segment, currency, search, sort, reset, Show more | **PASS** | browser-tested, below |
| 11 | **Download CSV** — exports only sales-qualified rows, respects filters | **PASS** | unfiltered 3,134 data lines = 3,134 rows; filtered 85 = 85; every exported row sales-qualified |
| 12 | **Partial TY** notice visible | **PASS** | *"TY September data is partial / current available data. Sales & ads available through 2026-09-29; traffic through 2026-09-27."* |

`npm run validate` — **22/22 gates PASS.**

Gates added for this correction: **15** population rule · **16** zero rows with LY=0 and
TY=0 · **17** date scope · **18** reconciliation against an independent DB aggregation ·
**19** enrichment never populates · **21** population rule recorded in `meta`.

## Browser verification

Tested headless on **`file://`** (the standalone) and **`http://localhost:3000`** (the
served version). Both load the same corrected dataset.

| | |
|---|---|
| Console errors / warnings | **0** |
| Failed requests | **0** |
| External references (`script[src]`, `link[href]`, `img[src]`) | **0** — fully self-contained |
| Account filter | 195 of 3,134, every row matching |
| Segment filter (stacked on account) | 85 of 195, every row D with LY > 0 and TY = 0 |
| Currency filter | 831 of 3,134, all EUR |
| Search | 1 of 3,134, match confirmed |
| Sort | ascending then descending on TY Sales, order verified both ways |
| Reset | returns to 3,134 with all four controls cleared |
| Show more | 400 → 800 rendered rows |
| Download CSV | filtered 85 = view; unfiltered 3,134 = full population |

## Wording

Subtitle now leads with **"Product sales comparison for September 2025 vs September
2026."** followed by an explicit scope paragraph: only listings with product sales in
either September are included, listings with no sales are excluded even where traffic or
advertising activity exists, and views/advertising figures enrich sales-qualified listings
only. The first summary card is **"Listings with September Sales"**, not "Total Listings".
The partial-TY banner is unchanged and still present.

## Database safety

| | |
|---|---|
| `ledsone` writes | **0** — SELECT only, via the Ledsone MCP as `dbhub_readonly` |
| `order_management_copy` writes | **1** — the `html_content` replacement on `ph_task` id 1947, below |
| Any other writes | **0** — no INSERT, no DELETE, no DDL, no other table or row touched |

One zero-row capability probe was run against `ph_task`
(`UPDATE ... WHERE id = 1947 AND FALSE`) before the push, to confirm the connection
permits the write. It matched no rows and changed nothing.

## PH Priors row 1947 — UPDATED

`build/push-ph-task.mjs` (run 2026-09-29 08:37:33 Asia/Colombo). One transaction,
parameterized SQL — the 1.6 MB of HTML never entered the statement text — guarded on
`id = 1947 AND assigned_user = 'utharsika' AND assigned_user_team = 'ph_priors'`, with the
row taken `FOR UPDATE` and the stored length + MD5 verified against the source file
**before** `COMMIT`.

Reached over the `temp_user` route to `order_management_copy`
(`149.28.134.54:5435` → server `10.8.0.3`), confirmed to be the same database and row
before any write. A dry run was executed and rolled back first.

| | Before | After |
|---|---|---|
| `html_content` length | 8,977,030 | **1,645,091** |
| `html_content` MD5 | `a60cb0be…488c8` | **`18f611aa29be9d90f662265f6802e63d`** |

**Integrity: PASS.** The stored MD5 equals the MD5 of `September-Comparison-Dashboard.html`
byte for byte. Re-verified afterwards through a *different* connection (the MCP connector,
as `postgres`) to rule out a same-session artefact — same length, same MD5, and the stored
HTML contains both the corrected scope wording and the partial-TY notice.

**Only `html_content` and `updated_at` changed.** Confirmed unchanged: `id`,
`project_name`, `project_code`, `task_name`, `task_id`, `team` (`PH Priors`), `developer`
(`Sreeginy`), `assigned_user` (`utharsika`), `assigned_user_team` (`ph_priors`),
`phase_level` (1), `version_level` (1), `version_status` (`released`), `action_took_by`
(NULL), `action_took_date_time` (NULL), `created_at`.

`updated_at` was set explicitly because `ph_task` has no `BEFORE UPDATE` trigger — the
schema documentation records that it is not auto-maintained.

**Duplicate rows created: 0.** `project_code = 'september-comparison'` still returns
exactly 1 row.
