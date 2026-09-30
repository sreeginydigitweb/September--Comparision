# Task Complete — September Comparison V1

Closed 2026-09-28. Reopened and corrected **2026-09-29**.

> ## SCOPE CORRECTION — 2026-09-29
>
> The senior rejected the V1 population (*"athila ellarda ID m varuthu"* — all the IDs are
> turning up) and restated the requirement as **the sales view report for September 2025
> and September 2026 only**. The population is now built from September sales alone —
> `LY Sales > 0 OR TY Sales > 0` — with traffic, ads and listing identity as enrichment
> that can never add a row.
>
> **17,845 rows → 3,134.** 14,739 zero-sales rows removed; 0 remain.
> Segments recalculated: **A 1,349 · B 80 · C 77 · D 1,296 · Other 332**.
> LY sales totals are unchanged, which proves the removed rows carried no September revenue.
>
> Every figure below marked 17,845 or carrying a V1 segment count is **obsolete**. The
> current numbers are in `validation/scope-correction-2026-09-29.md` and
> `evidence/extract-2026-09-29/counts.md`. The standalone deliverable is now **1.6 MB**.
>
> **PH Priors row 1947 updated 2026-09-29** — `html_content` only, 1,645,091 chars, md5
> `18f611aa29be9d90f662265f6802e63d`, verified against the source file from a second
> connection. No other column changed, no duplicate row created.

## What was delivered

> **Final portable deliverable: `September-Comparison-Dashboard.html`** (8.6 MB) — one
> self-contained file. No runtime, no server, no database, no internet, no sibling files.
> Double-click to open. Verified offline from file:// in an isolated folder with 0 network
> requests and 0 console errors; all 16 standalone tests pass. The localhost version
> (`index.html` + `data/` + `build/`) is preserved and still works. Rebuild with
> `node build/standalone.mjs`. See `validation/final-validation.md` §0.


> **CSV export added 2026-09-28.** `Download CSV` sits beside Clear filters with a live
> count. It exports the **full current filtered + sorted set** (all 17,845 rows unfiltered,
> not the 400 rendered), respecting Account, Segment, Currency and search, as UTF-8 CSV
> with a BOM. Client-side from the loaded dataset — no query, API, backend or dependency.
> A 22nd `Currency` column follows the required 21 so money values are unambiguous.
> Validated by real downloads — see `validation/final-validation.md` §0a.


> **UI polish pass applied 2026-09-28 (presentation only).** Title changed to
> "September Performance Comparison — LY vs TY"; eBay ID and SKU frozen horizontally so
> they stay visible when scrolling right; scrollbar made clearly usable so ROAS/ACoS and
> Segment are easy to reach; Segment badges given borders, descriptive labels and
> per-rule tooltips. No data, calculation, SQL, segmentation rule or dependency changed,
> and the dataset was not regenerated. Re-validated — see `validation/final-validation.md` §0.


A September LY vs TY eBay comparison dashboard, running locally, built read-only from
`ledsone`.

| | |
|---|---|
| **Start command** | `npm start` (from the project root) |
| **Local URL** | `http://localhost:3000` |
| **Validate** | `npm run validate` — exit 0 |
| **Dependencies** | none — Node built-ins only |
| **Rows** | 17,845 |
| **Grain** | Account + eBay item_id + marketplace (verified unique) |
| **Accounts** | 22 eBay sub_sources |
| **Currencies** | GBP 8,942 · EUR 5,277 · USD 3,626 — never summed together |
| **LY** | 2025-09-01 → 2025-09-30 (full) |
| **TY** | 2026-09-01 → 2026-09-30 (**partial**): sales & ads to 2026-09-28, traffic to 2026-09-26 |

## Segment counts

| Segment | Rows |
|---|---|
| A — YoY Winner | 1,318 |
| B — YoY Recovery | 93 |
| C — Lost Ad Sales | 77 |
| D — Lost Performer | 1,305 |
| Other | 15,052 |
| **Total** | **17,845** |

## Validation result

| Stage | Result |
|---|---|
| Skill validation | **PASS** (2 MAJOR rulebook conflicts found and fixed — docs only, no code change) |
| Data validation (16 gates) | **PASS** — exit 0 |
| Browser validation (10 checks) | **PASS** — 0 console errors, 0 failed requests |
| Original requirements | **PASS** — 21 columns, both filters, all behaviours |
| Database safety | **PASS** |

Detail: `validation/final-validation.md`.

## Known V1 limitations (documented, not defects)

1. TY September is partial; sources end on different days (traffic 26th, sales/ads 28th).
2. Ad Spend is the eBay performance-report figure, not the billing record — the billing
   record holds only ~3 days of TY September. One source only, so no double-count.
3. Ad Sales under-attribute Promoted Advanced by ~25% (limit of the only per-listing source).
4. LY/TY Price are realised ASP — no historical list price exists anywhere in `ledsone`.
5. ASP averages across variations (92% of item_ids carry more than one SKU).
6. GBP/EUR/USD never blended — no single combined monetary total exists by design.
7. **Three V1 rules are implementation choices, not business-confirmed:** segment
   precedence D→C→B→A, Segment D requiring TY Sales exactly 0, and Segment B's 7-day
   recovery window. Each is a one-line change once the business decides.
8. Listing Analysis and Demand Analysis (workflow stages 7–8) absent — no verified
   LY-vs-TY source. Competitor price likewise.
9. Snapshot only — TY figures change on re-run while September is open.

## Database safety

`ledsone` — SELECT / READ ONLY throughout, as `dbhub_readonly` (non-superuser;
INSERT/UPDATE/DELETE/CREATE all denied, re-verified at close).
**Database writes: NONE.** `order_management_copy` / `analytics.ph_segment` never queried.

## Git

**Commit: NONE. Push: NONE.** No branch created, no remote modified.

A pre-existing repository (`9a8bbfb "first commit"`, remote
`github.com/sreeginydigitweb/September--Comparision.git`) was present before this work
began and was left untouched. All build output is uncommitted on disk.

## Next step, when the business is ready

Confirm or change the three V1 rules in item 7, then re-run
`node build/build.mjs <extract.json> && npm run validate`. Re-extract for fresher TY data
once September closes — the same packs in `sql/` apply unchanged.
