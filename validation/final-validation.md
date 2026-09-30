# Final Validation — 2026-09-28

Result: **PASS**. Re-confirmed after the UI polish pass (§0).

## 0. Standalone HTML conversion — packaging only, validated offline

Deliverable: **`September-Comparison-Dashboard.html`** (8,982,838 bytes / 8.6 MB), built by
`build/standalone.mjs`. Packaging only — the fetch call is swapped for the embedded
snapshot and nothing else changes. The script refuses to build unless the dataset is
exactly 17,845 rows with segments A 1,318 / B 93 / C 77 / D 1,305 / Other 15,052.

Tested from `file://` in an **isolated temp folder containing only that one file** — no
`data/`, no siblings, no server.

| Test | Result |
|---|---|
| T1 Opens via file:// | PASS — `location.protocol` = `file:` |
| T2 No external requests | PASS — `performance.getEntriesByType(resource)` = **0** |
| T3 Dataset 17,845 rows | PASS |
| T4 Segments A 1,318 / B 93 / C 77 / D 1,305 / Other 15,052 | PASS |
| T5 Account filter | PASS — `bestbringer` 98, export 98 |
| T6 Segment filter | PASS — D 1,305 |
| T7 Currency filter | PASS — EUR 5,277, export 5,277 |
| T8 Search | PASS — `vintage` 1,635, export 1,635 |
| T9 Sorting | PASS — LY Views desc 3313, 3056, 2613, 2224, 1917 |
| T10 Clear filters | PASS — back to 17,845 |
| T11 Show more | PASS — 400 to 800 |
| T12 CSV full export | PASS — **17,845** rows, BOM present |
| T13 CSV filtered export | PASS — D 1,305, EUR 5,277, account 98, search 1,635 |
| T14 21 columns correct order | PASS |
| T15 Console errors | PASS — **0 errors, 0 failed requests** |
| T16 No NaN/Infinity/undefined/[object Object] | PASS — 0 rows with a wrong field count |

Also confirmed present offline: summary cards, per-currency KPI cards, partial-TY notice,
sticky header, frozen eBay ID/SKU columns, segment badges, dashboard notes.

Static check of the file: **0** occurrences of `fetch(`, `localhost`,
`september-comparison.json`, `http://`/`https://`, `<script src=` or
`<link rel=stylesheet`.

**The localhost version is preserved and still working** — `index.html` unchanged (still
fetches), server returns 200, `npm run validate` exit 0.

## 0a. CSV export feature — added and validated

`Download CSV` added beside **Clear filters**, with a live count (`Download CSV (1,305)`)
that updates on every filter/search change and disables at zero rows. Implemented
**client-side from the already-loaded dataset** — no query, no API, no backend endpoint,
no dependency, no regeneration. Confined to `index.html`.

**It exports the full filtered set, not the 400 rendered rows.** Verified by real
downloads (not by reading page state):

| Test | Dashboard | Exported | Result |
|---|---|---|---|
| T1 no filters | 17,845 | **17,845** | PASS |
| T2 Segment D | 1,305 | **1,305** (all Segment `D`) | PASS |
| T3 Account (`bestbringer`) | 98 | **98** | PASS |
| T4 Account + Segment A | 2 | **2** | PASS |
| T5 Search (`vintage`) | 1,635 | **1,635** | PASS |
| T6 Currency EUR | 5,277 | **5,277** (all `EUR`) | PASS |
| T7 CSV structure | — | 21 required columns in the required order | PASS |
| T8 Escaping / tokens | — | 0 rows with a wrong field count across all 17,845; no `NaN`, `Infinity`, `undefined`, `[object Object]`; `N/A` and `NEW` consistent with the dashboard | PASS |
| T9 Dashboard regression | — | Account, Segment, Currency, search, sorting, reset and Show more all still correct | PASS |
| T10 `npm run validate` | — | exit 0, all 16 gates | PASS |

**Sort order preserved** — CSV rows match the sorted table exactly (LY Views descending:
3313, 3056, 2613, 2224, 1917 in both).

**Escaping proven on real data**, e.g.
`124744378691,"22, 33, 26, 39 connectors (12 variations)",…` — SKUs containing commas are
quoted and open as a single column. UTF-8 BOM written so Excel reads `£`/`€` correctly.

**Two deliberate decisions, recorded:**

1. **A 22nd `Currency` column is appended after the required 21.** Monetary values are
   exported as plain numbers (spreadsheet-summable, no symbol), which would be ambiguous
   across GBP/EUR/USD — and this project's hard rule is that currencies are never blended.
   The required 21 keep their exact order and positions; currency sits after them.
2. **Search matches `title`, which is not an exported column.** So a `vintage` export
   legitimately contains rows with no "vintage" in the ID or SKU — verified that every
   such row carries it in the title (e.g. *"Industrial Wall Light Vintage Adjustable Wall
   Sconce…"*). The filter is correct; the title simply is not one of the 21 columns.

Filenames reflect active filters: `September-Comparison-2026.csv`,
`…_Segment-D.csv`, `…_bestbringer_Segment-A.csv`, `…_EUR.csv`, `…_filtered.csv`.

## 0b. UI polish pass — presentation only, re-validated

Changes were confined to `index.html`. **No data, calculation, SQL, segmentation rule,
metric or dependency was touched**, and the dataset was **not regenerated** — still the
same file (17,845 rows; A 1,318 · B 93 · C 77 · D 1,305 · Other 15,052).

| Change | Verified |
|---|---|
| Title → "September Performance Comparison — LY vs TY" | PASS — both `<title>` and `<h1>` |
| eBay ID + SKU frozen horizontally | PASS — `position:sticky` at `left:0` / `left:118px`, opaque backgrounds; cells stay in place and remain readable (not overlapped) when scrolled fully right |
| Horizontal scrollbar clearly usable | PASS — 15px track with a grab-able thumb; ROAS/ACoS **and** Segment both fully visible after scrolling right |
| Segment badges clearer | PASS — bordered chips with descriptive labels (`A · Winner`, `B · Recovery`, `C · Lost Ads`, `D · Lost Perf`, `Other`) and a tooltip stating each rule |
| 21-column order unchanged | PASS — verified against the required order |
| Filters / search / reset / sorting preserved | PASS — Segment D → 1,305; +search → 613; reset → 17,845 |
| Segment sorting uses the underlying value, not the new label | PASS — ascending starts at A, descending starts at Other |
| Console | PASS — 0 errors, 0 failed requests |
| `npm run validate` | PASS — exit 0, all 16 gates |

Segment labels are a **display mapping only**; the stored value, the filter and the sort
key all remain the bare `A`/`B`/`C`/`D`/`Other`.

## 1. Skill validation — SKILL → implementation → data → output

All five skills readable and intact (441 / 452 / 433 / 479 / 209 lines).

| Skill | Contract | Implementation | Result |
|---|---|---|---|
| `database-check` | verify connection, schema, read-only posture; never writes | posture re-verified at the DB (`dbhub_readonly`, non-superuser, INSERT/UPDATE/DELETE/CREATE all false) | **PASS** |
| `postgres-mcp-fetch` | read-only fetch via MCP; never generates HTML | extraction ran SELECT-only through the Ledsone MCP; produces JSON only | **PASS** |
| `data-transform` | reshape fetched rows; never invents data; never generates HTML | `build/build.mjs` merges + derives only; emits JSON; no markup | **PASS** |
| `static-html-generate` | produce the page from verified data; never invents data | `index.html` fetches the built dataset; no hard-coded figures | **PASS** |
| `september-yoy-segmentation` | project rulebook + orchestration | **2 MAJOR conflicts found and fixed — see §2** | **PASS after fix** |

**Boundary checks (grep over `sql/`, `build/`, `index.html`, `data/`):**

- No reference to `ph_segment`, `order_management_copy` or `varman` anywhere in the implementation — **clean**
- No INSERT / UPDATE / DELETE / ALTER / DROP / CREATE / TRUNCATE in any SQL or build file — **clean** (only hit is the prohibition text in `sql/README.md`)
- `all_list = 1` present in the identity pack — **applied**
- Each source aggregated to its own grain before joining — no row multiplication (gate 2)

No harmful overlap between skills: the four reused skills each refuse their neighbour's job, and the project skill sequences them without reimplementing any.

## 2. Fixes made

Both were defects in the project's **own rulebook** contradicting the shipped, validated
system. Documentation-only; **no code was changed**.

| # | Severity | Defect | Fix |
|---|---|---|---|
| 1 | **MAJOR** | `september-yoy-segmentation` "Source rules" named `accounting.ebay_order_expenses` as the Ad Spend source. V1 ships `listing_performance.ad_fees_listing_currency`. A future run following the skill would have changed the spend source out from under a validated dashboard | Rewrote the bullet to state the P&L rule, the V1 deviation, the reason (billing record holds ~3 TY days), and the revisit condition |
| 2 | **MAJOR** | The "Stop here if PENDING ANALYSIS" block told a run to **halt** on the Segment B/D thresholds, precedence and nine metric definitions — all settled by fast-track Analysis and shipped | Replaced with the settled V1 rule table, flagging which three are implementation choices awaiting business confirmation, and retaining the refusal to invent anything *not* in the analysis |
| 3 | MINOR | Skill's comparison table still read `Grain: PENDING ANALYSIS` | Corrected to the shipped grain |
| 4 | MINOR | Bike Method standing entry referenced the removed blocks | Replaced with an applied-change record and the three open business questions |
| 5 | INFORMATIONAL | `build-plan-v1.md` specified `render.mjs` + `template.html` and an embedded dataset; as built, `index.html` fetches the JSON and those two files were not created | Added an "AS BUILT — deviation, deliberate" note: the real dataset is 17,845 rows / 8.6 MB and a localhost URL was required, so embedding had no benefit |

## 3. Data validation — `npm run validate`, exit code **0**

All 16 gates PASS, unchanged after the fixes:

rows 17,845 · key unique 17,845/17,845 (no row multiplication) · LY/TY sales reconcile
per currency · ad spend matches the single selected source · 3 separate currency buckets,
none blended · exactly one segment per row · segment counts sum to 17,845 · every D has
LY>0 & TY=0 · every C has LY ad>0 & TY ad=0 and is not D · every B is declining +
recovering and not D/C · every A is TY>LY after precedence · no NaN · no Infinity · every
numeric field is number or null · partial-TY metadata present · LY and TY both non-empty.

## 4. Browser validation — `http://localhost:3000`, HTTP 200

| # | Check | Result |
|---|---|---|
| 1 | Initial load | PASS — "Showing 400 of 17,845 listings" |
| 2 | Account filter | PASS — `bestbringer` → 98 of 98 |
| 3 | Segment filter | PASS — A → 1,318 |
| 4 | Account + Segment combined | PASS — 2 of 2, all verified segment A |
| 5 | Search | PASS — item id → 1 of 1 |
| 6 | Numeric sort | PASS — TY Sales, LY Views and Ad Clicks each verified genuinely descending on non-zero values |
| 7 | Reset | PASS — count, search box and both selects restored |
| 8 | Partial-TY warning | PASS — visible, with both source dates |
| 9 | 21 table columns | PASS — exactly 21, in the specified order |
| 10 | Console errors | PASS — **0 errors, 0 failed requests** |

## 5. Original requirements

All 21 columns present in the required order; Account and Segment filters both working;
LY = September 2025, TY = partial September 2026; search, sorting, reset, result count,
localhost, partial-TY notice and currency separation all confirmed.

Segmentation implements D (`LY>0 AND TY=0`) → C (`LY ad>0 AND TY ad=0`) → B (`TY<LY` AND
latest 7 TY days > preceding 7 AND ≥14 usable TY days) → A (`TY>LY`) → Other, exactly one
per row, verified by gates 6–11.

## 6. Database safety

`ledsone` — **SELECT / READ ONLY**, re-verified at the database this run:
`dbhub_readonly`, not superuser, INSERT/UPDATE/DELETE/CREATE all `false`, SELECT `true`.

**Database writes: NONE.** `order_management_copy` and `analytics.ph_segment` not queried.
