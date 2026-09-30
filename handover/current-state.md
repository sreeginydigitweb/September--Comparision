# Handover — Current State

Updated **2026-09-29** — sales-only scope correction applied, validated, and pushed to PH
Priors row 1947. **COMPLETE.**

## SCOPE CORRECTION — 2026-09-29 (read this first)

The senior rejected the V1 population: *"athila ellarda ID m varuthu"* — all the IDs are
turning up — and restated the requirement as **the sales view report for September 2025
and September 2026 only**.

V1 built rows from a `FULL OUTER` merge of identity, sales, traffic and ads, so an eBay id
that merely existed in a listing, traffic or ad record appeared carrying zero sales. The
population is now **sales-driven**:

```
COALESCE(ly_sales, 0) > 0  OR  COALESCE(ty_sales, 0) > 0
```

Traffic, ads and listing identity `LEFT JOIN` onto that population — they enrich a
sales-qualified row and can never introduce one.

| | V1 (obsolete) | Corrected |
|---|---|---|
| Rows | 17,845 | **3,134** |
| Zero-sales rows | 14,739 | **0** |
| A / B / C / D / Other | 1,318 / 93 / 77 / 1,305 / 15,052 | **1,349 / 80 / 77 / 1,296 / 332** |

**LY sales totals are unchanged** (GBP 92,129.93 · EUR 43,759.15 · USD 1,985.20) — the
14,739 removed rows carried no September revenue at all. Full evidence:
`evidence/extract-2026-09-29/counts.md`; record: `validation/scope-correction-2026-09-29.md`.

Grain is unchanged: `Account + eBay item_id + marketplace`. Row grain, metric formulas,
currency separation and the Ad Spend source decision were **not** touched.

> **The old counts are dead.** 17,845 rows and the V1 segment totals are no longer asserted
> anywhere — `build/standalone.mjs` derives its expectations from the snapshot it is given.
> Do not reintroduce them.

## Where the project is

| | |
|---|---|
| **Stage 1 — Discovery** | COMPLETE |
| **Stage 2 — Structure & Skill Setup** | COMPLETE |
| **Stage 3 — Analysis (fast-track)** | COMPLETE — `documentation/analysis-v1-decisions.md` |
| **Stage 4 — Build** | COMPLETE |
| **Stage 5 — Skill + Final Validation** | **COMPLETE — PASS.** See `validation/final-validation.md`, `closure/task-complete.md` |
| **Stage 6 — Sales-only scope correction (2026-09-29)** | **COMPLETE — PASS.** See `validation/scope-correction-2026-09-29.md` |
| **PH Priors row 1947** | **UPDATED 2026-09-29** — holds the corrected 3,134-row HTML |
| **Next** | Business review of the V1 implementation rules (below). Nothing blocks use of the dashboard |

## Final portable deliverable

**`September-Comparison-Dashboard.html`** (1.6 MB) — the file to hand over.

| | |
|---|---|
| **Runtime** | None |
| **Database required at runtime** | No — it is a snapshot |
| **Internet required** | No |
| **Localhost required** | No |
| **Open method** | Double-click the HTML file, or open it directly in Chrome/Edge |

Copy it anywhere — it needs no sibling files. Data, CSS, JavaScript and the CSV export
are all embedded; it makes zero network requests. Rebuild it after a data refresh with
`node build/standalone.mjs`.

## Running the dashboard (localhost version, still available)

Page title: **September Performance Comparison — LY vs TY**. eBay ID and SKU are frozen
horizontally; Segment badges carry descriptive labels and per-rule tooltips.
**Download CSV** exports the full current filtered set (not just the rendered rows),
plus a trailing Currency column so money values are never ambiguous.


```
cd "C:\Users\LED 309\OneDrive\Documents\September -Comparision"
npm start          # -> http://localhost:3000
npm run validate   # re-runs the data gates
```

No dependencies are installed and none are needed — Node built-ins only
(`node --version` v24.20.0). If port 3000 is busy the server steps up to 3001+ and prints
the URL it bound to.

**To refresh the data:** re-run `sql/f-combined-sales-driven.sql` through the Ledsone MCP
(see `evidence/extract-2026-09-29/counts.md`), then

```
node build/build.mjs evidence/extract-2026-09-29/pack-f-sales-driven-extract.json
npm run validate
npm run standalone
```

`build/build.mjs` refuses any extract containing a row with LY = 0 and TY = 0, so a
regression back to the all-ID population fails the build rather than reaching the page.

## Six-account scope (2026-09-29) + PH push — DONE

Row **1947** now holds the six-account standalone HTML: **68,632 chars, md5
`2f3aaaf37dc1cdf5072a7fcb63586130`** — an exact match to
`September-Comparison-Dashboard.html`. Only `html_content` and `updated_at` changed; every
identity field is untouched and no duplicate row was created.

Re-push after any data refresh with `build/push-ph-task.mjs`:

```
PH_DB_URL='postgresql://USER:PASS@149.28.134.54:5435/order_management_copy' npm run push-ph -- --dry-run
PH_DB_URL='postgresql://USER:PASS@149.28.134.54:5435/order_management_copy' npm run push-ph
```

Credentials are **not** stored in this repo. The `temp_user` route to
`order_management_copy` is in the team's `temp_user*.py` sample script; that host
port-forwards to the same server the MCP connector reaches at `10.8.0.3`, which is not
directly routable from this machine. The script refuses to run without `PH_DB_URL`, guards
on `id = 1947 AND assigned_user = 'utharsika' AND assigned_user_team = 'ph_priors'`, and
aborts the transaction unless the stored MD5 matches the source file.

> Do **not** push through the MCP connector instead. It would mean reproducing 1.6 MB of
> HTML character-exact inside SQL statement text; the parameterized script is the only
> sound route.

## Build result

**77 rows · 6 accounts · 2 categories (Lamp Shade 72, Wall Plug 5) · A 38 · B 1 · C 3 · D 29 · Other 6.**
Product scope = PH user utharsika (staff.users.id 109) eBay assignments, from staff.ph_categories
+ staff.ph_category_products. See validation/utharsika-product-scope-2026-09-29.md.
Product scope (Lamp Shade / Wall Plug) remains PENDING — see validation/six-account-scope-2026-09-29.md.
All 38 data gates PASS. Browser-tested on `file://` and localhost: 0 console errors,
0 failed requests, 0 external references; filters, search, sort, reset, Show more and
Download CSV all verified against the corrected population.
Records: `validation/stage-3-build.md`, `validation/final-validation.md`,
`validation/scope-correction-2026-09-29.md`, `closure/task-complete.md`.

## What to read first

1. `documentation/analysis-v1-decisions.md` — **the authority.** Every locked metric
   formula, the row grain, the Ad Spend deviation (§9) and the segmentation rules
2. `closure/task-complete.md` — what was delivered, how to run it, the limitations
3. `documentation/project-baseline.md` — original scope and the segment rules as supplied
   (its PENDING ANALYSIS list is now resolved by the analysis in item 1)
4. `data-maps/source-data-map.md` — every field mapped to a verified `ledsone` source
5. `.agents/skills/september-yoy-segmentation/SKILL.md` — the project rulebook and pipeline
6. `validation/final-validation.md` — what was checked at close, and how

## Decisions already taken — do not reopen

- **TY = partial September 2026** against **LY = full September 2025**. User approved
  2026-09-28. Do not block on the month being unfinished; do not silently day-cap LY.
- **"Segment" means A/B/C/D only.** `analytics.ph_segment` is out of scope, confirmed by
  the user. Do not reintroduce it or reach into `order_management_copy`.
- The requirement artefacts were supplied externally via ChatGPT and transferred into the
  Discovery prompt. **Their absence locally is not a blocker.** The transferred
  requirements are the working specification.

## Access

- **Use the Ledsone MCP** (`claude.ai Ledsone postgres`). It connects to `ledsone` on the
  VPS as `dbhub_readonly` — verified non-superuser, SELECT only, INSERT/UPDATE/DELETE and
  CREATE all denied.
- **Do not use** `claude.ai postgres (2)` — it connects to `order_management_copy` as the
  `postgres` superuser, which is write-capable, and holds the out-of-scope `ph_segment`
  and the `varman_aios` schema.
- The **Windows PostgreSQL copy is frozen** since 2026-07-29. Always go through the MCP.

## Traps that will otherwise be rediscovered the hard way

1. **Ad Spend — two sources, and V1 does not use the one the rule names.** The verified
   P&L rule is `accounting.ebay_order_expenses` (`AD_FEE + PREMIUM_AD_FEES`), and the
   performance-table fees must never be added on top of it. **V1 uses
   `listing_performance.ad_fees_listing_currency` alone**, because the billing source holds
   only ~3 days of TY September (max 2026-09-03). One source only, so no double-count.
   See `documentation/analysis-v1-decisions.md` §9 — revisit when settlement catches up.
2. **`all_list = 1`** on every `listings.ebay_listings` read, or parent container rows
   inflate and duplicate the result.
3. **`attributed_sales` and `sold` are counts, not money.**
4. **`sale_amount_listing_currency` mixes GBP and EUR** — group by `marketplace_id` first.
5. **`listing_performance` under-attributes Promoted Advanced by ~25%** and must never be
   added to or compared against `campaign_performance`.
6. **`ebay_order_expenses.item_id` holds a listing id only on the two ad-fee types**;
   on FVF and refund rows it is a transaction id.
7. **The three TY sources end on different days** — as of the 2026-09-29 re-extract,
   traffic 2026-09-27, ads and orders 2026-09-29. Re-check on every refresh; the dates are
   read from `meta.source_max_dates`, not hard-coded in the page.
8. **Population is sales-driven, and it is easy to undo by accident.** Any change that
   `FULL OUTER JOIN`s traffic or ads back into the base population reintroduces the exact
   fault the senior rejected. Gates 15, 16 and 19 and the guard at the top of
   `build/build.mjs` exist to catch that.

## Open questions for the business (V1 shipped with documented interim answers)

All of these are **implemented and working** under V1 operational definitions. None blocks
use of the dashboard; each is a one-line change if the business decides differently.

1. Segment B — "recent sales are improving" → V1: latest 7 TY days > preceding 7 TY days
2. Segment D — "approximately 0" → V1: TY Sales exactly 0 (deliberately conservative)
3. Segment precedence → V1: D → C → B → A → Other, one label per row
4. Revenue definition → **resolved by an authoritative rule**, not a V1 guess:
   `item_price × item_quantity` (`business/queries/ph-sales-by-channel.md`)

## Next action

Business review of the V1 rules that are implementation choices, not owner decisions:
segment precedence D->C->B->A, Segment D requiring TY Sales exactly 0, the Segment B
7-day recovery window, and the Ad Spend source deviation (section 9 of the analysis).
Each is documented and each is a one-line change once confirmed.

---

## 2026-09-30 — Orders corrected to actual distinct orders

Scope of the change: **LY Orders and TY Orders only.** Nothing else was touched.

**Was:** `business_reports.ebay_traffic_data.quantity_sold` — eBay-reported *units sold*, so
an order buying 3 units published as 3 "Orders".

**Now:** `COUNT(DISTINCT order_management.orders.order_id)` via `order_item_info` at
account + eBay item_id + marketplace, eBay source, `status NOT IN ('Cancelled','Refunded')`,
`order_id` non-blank. `item_quantity` is never summed into Orders.

- Query: `sql/h-actual-orders.sql`
- Evidence: `evidence/extract-2026-09-29-fresh/actual-orders.json`
- Full record: `validation/actual-orders-2026-09-30.md`

**Control `164525233292` September 2025: 66 order lines -> 62 distinct orders.** Verified from
raw records before rebuilding. (`quantity_sold` said 83; OMS units said 94.)

Totals: LY Orders 235 -> **185**, TY Orders 197 -> **132**. A field-by-field diff of all 186
rows shows changes only in `ly_orders` (26 rows), `ty_orders` (23 rows) and the two new
`*_qty_sold` audit fields — **0 changes** to Sales, YoY, Views, Conversion, Avg Price, ad
metrics, SKU image, SKU ID, Category, Segments, currencies or row count.

**Conversion % is deliberately unchanged** — still `quantity_sold / ebay_views * 100`, which
is eBay's own STR. Gate 41b holds it byte-identical to the pre-fix dataset on all 186 rows.
`ly_qty_sold` / `ty_qty_sold` carry that numerator as audit fields. **Do not "tidy" Conversion
onto distinct Orders** — it would stop matching eBay.

### Two traps for whoever picks this up

9. **The TY Orders bound is a TIMESTAMP, `2026-09-29 10:27:17`, not a date.** It is the instant
   the pack G Sales snapshot was taken. Proven, not assumed: recomputing Sales and OMS units
   from raw with that bound reproduces the snapshot on all 186 rows with 0 differences.
   End-of-day would add order `24-15218-31602` (item 266004810103, GBP 27.78) that Sales does
   not contain, publishing Orders 1 against Sales 0.00. **On the next rebuild move the pack G
   sales window and this bound together — never one without the other.**
10. **`Orders <= quantity_sold` is NOT a valid invariant** and is not asserted. On 11 rows
   distinct orders legitimately exceed `quantity_sold`, because the traffic feed's September
   coverage is incomplete (LY 28 of 30 days, TY 27) while orders cover every day. Gate 40b
   asserts `Orders <= OMS units` instead — same source, same window. An earlier draft
   asserted the wrong premise and the gate caught it; the premise was fixed, not the tolerance.

All gates pass — 52 numbered gates plus the coverage check, 53 PASS, 0 FAIL. 13 eBay IDs x LY/TY = 26 raw reconciliation checks, 0 failures, all six
accounts. Dashboard re-rendered clean: 186 rows, 0 console errors, control row shows
LY Orders 62 / TY Orders 21 with LY Conv still 2.72%.


---

## 2026-09-30 — FINAL RAW DATA AUDIT (full re-extract, every metric)

The senior required actual data, validated against fresh raw LEDSone records rather than against
the dashboard. The whole dataset was re-derived. **All gates pass. Published to PH row 1947.**

### The single biggest structural change

Every metric now comes from **ONE query** — `sql/i-fresh-authoritative.sql`, 33 columns.
Packs G and H and both side-car evidence files (`ly-sku-ad-split.json`, `actual-orders.json`)
are gone from the build path. The reason: a frozen side-car had already drifted from the query
that was meant to reproduce it (see the £14.29 defect below). One snapshot, one query, no drift.

### Two real defects found in raw, both corrected

1. **Orders meant units.** `quantity_sold` is eBay-reported units sold, so an order buying 3
   units published as 3 "Orders". Now `COUNT(DISTINCT orders.order_id)`.
   Control 164525233292 Sept 2025: **66 order lines → 62 distinct orders**, 94 units,
   83 `quantity_sold`, £1,210.05 revenue, 0 Cancelled/Refunded. All four reproduced exactly.
2. **LY Ad-Generated was £14.29 short.** The AD_FEE query filtered fees by
   `transaction_date` within September 2025. eBay bills on its own clock: order
   `11-13519-57563` was placed **2025-09-01** but billed **2025-08-31**, so it was silently
   dropped (item 164043595851 read 231.98 instead of 246.27). The fee date is a billing
   artefact — attribution is the `(order_id, item_id)` pair. Window removed; LY Ad-Generated
   is back to 2,952.12 and is now derived in-query, not read from a frozen file.

### Numbers now published

LY Sales 3,182.15 (= Ad-Generated 2,952.12 + Non-Ad 230.03) · TY Sales **2,535.34**
LY/TY Orders **185 / 133** · units 259 / 209 · lines 194 / 144 · `quantity_sold` 235 / 204
Views 8,487 / 6,404 · Impressions 1,594,442 · Clicks 2,094 · Spend 295.26
Segments D 28 · A 38 · B 2 · C 3 · Other 115 (D 29→28 and B 1→2 moved on fresh TY data)

### Raw reconciliation

**20 eBay IDs x 26 metrics = 520 checks, 0 failures**, plus 42 supporting-field checks and 3
Segment-B window checks — **565 raw checks, 0 failures**. All six accounts, both categories, all
five segment values, and rows with sales, zero sales, multi-quantity orders, multi-line orders,
ads and no ads. Matrix: `validation/raw-reconciliation-2026-09-30.csv`.

### Traps for whoever picks this up next

11. **Do NOT reintroduce a fee-date window on AD_FEE.** It looks like an obvious optimisation
   and it silently loses revenue. Bound the scan with the semi-join to the order population
   instead — that is why `adfee_ly` has an `EXISTS` rather than a date filter.
12. **`Orders <= quantity_sold` is not a valid invariant.** The traffic feed's September
   coverage is incomplete (LY 28 of 30 days, TY 28), so it can report fewer units than there
   were real orders. Gates assert `Orders <= units` and `Orders <= lines` — same source,
   same window. An earlier gate asserted the false premise and failed correctly; the premise
   was removed, not the tolerance.
13. **Conversion % is units-based on purpose** and must stay `quantity_sold / ebay_views`
   (= eBay STR). Gate 41 enforces it. `LY Orders = 62` does NOT imply `Conversion = 62/Views`.
14. **The old gate 41b froze TY Conversion against a pre-fix baseline.** That premise expired
   with this re-extract (TY traffic gained 2026-09-28) and would have forced a stale rate to be
   published. It is now an **LY regression guard** instead: LY is closed data and is asserted as
   absolutes (Sales 3,182.15 · Orders 185 · Views 8,487 · Units 259 · Ad-Generated 2,952.12).
15. **Each TY source ends on a different day** — orders 2026-09-29 (assigned population),
   traffic 2026-09-28, PPC 2026-09-30, AD_FEE 2026-09-03. Published in
   `meta.source_max_dates` and shown in the dashboard note. Re-check before every rebuild.
16. **TY Ad-Generated stays `Pending`.** AD_FEE reaches only 2026-09-03 (3 of 29 TY days).
   Never compute it; `0` reads as "no ad sales", `null` reads as "not yet known".

### New gates

40e (`Orders <= lines`, and multi-line orders demonstrably collapse) · 41b (LY regression
guard) · 41c (**every published field on every row equals the raw extract** — 186 x 16 = 2,976
checks). `build.mjs` also throws before writing if `orders > units`, `orders > lines`,
`ly_ad_generated > ly_sales`, or any extract row is not 33 columns wide.

---

## 2026-09-30 — published view restricted to A/B/C/D (display scope only)

The four business segments (Ebay.xlsx -> "Segmentation") classify **71** of the 186 assigned rows.
The remaining **115** match none of them. They were audited row by row first
(`validation/segment-other-audit-2026-09-30.md`, `validation/other-rows-audit-2026-09-30.csv`):
**0** were misclassified, so nothing could be legitimately reassigned and nothing was
force-classified. The business then chose to exclude them from the published view.

**This is a display/publication scope, not a data change.** `data/september-comparison.json` still
holds all 186 rows with every metric untouched. `index.html` filters once at load:

```js
const PUBLISHED_SEGS = ['A', 'B', 'C', 'D'];
DATA = SOURCE.filter(r => PUBLISHED_SEGS.includes(r.segment));
```

Published: A 38 · B 2 · C 3 · D 28 · **Total 71 = Listings shown**.

### Trap 17 — the published view omits most of the trade, by design

Excluding the unclassified rows removes **61.7% of LY Sales** (GBP 1,962.73 of 3,182.15) and
**66.5% of LY Orders** (123 of 185), because the group contains the six largest declining
listings — **including the senior control SKU `164525233292`** (LY GBP 1,210.05 / 62 orders).

That SKU is unclassified because it is still selling (TY 515.21, so not D), still making ad sales
(TY Ad Sales 172.50, so not C), down YoY (not A) and not recovering (last7 40.77 vs prev7 235.03,
so not B). **If someone asks "where is the control SKU?", this is why.** The header and Data Notes
say so on the page: `71 products · A/B/C/D only (115 unclassified of 186 assigned not shown)`.

Do not "fix" this by force-classifying those six into B or D — that would attach the wrong
"Main Action" from the segmentation sheet. It needs a business rule (a fifth segment, or a named
"Declining" rule), not code.

### Trap 18 — never read the published totals as the assignment

Cards, counts and per-currency totals now describe the published 71, not utharsika's 186 assigned
products. Gate 52 keeps the distinction honest: it asserts the retained rows still match the raw
extract AND that the 115 unclassified rows are still present in the dataset.

### Gates 49-52 added

49 published population is exactly A+B+C+D and self-consistent · 50 allow-list present in BOTH
index.html and the packaged standalone, no Other option/label/badge · 51 cards are
Listings shown + A/B/C/D + Total, Other card gone · 52 exclusion is display-only (retained rows
match raw, all 25 metric fields intact, 115 unclassified still in the dataset).
`build/standalone.mjs` throws if the packaged page loses the allow-list or the load-time filter,
regains an Other option, or would publish 0 rows.

---

## 2026-09-30 — D is now the classification FALLBACK; all 186 products shown

**Supersedes the previous section.** The A/B/C/D-only publication filter hid 115 of 186 assigned
products, control SKU included. The business rule is now: anything the A/B/C rules do not match is
classified **D — Lost Performer** rather than hidden.

### The change (one line, in the one place that owns classification)

`build/build.mjs`, segment derivation — the four rules are tried in exactly the order they always
were, so every product that already earned A, B, C or D keeps it. Only the final branch changed:

```js
else segment = 'Other';   // was: became invisible downstream
else segment = 'D';       // now: fallback
```

`index.html` no longer filters the view at all (`DATA = SOURCE`). Verified: 71 previously
classified rows kept their exact segment, all 115 former `Other` rows became D, 0 exceptions.

### Counts

A **38** · B **2** · C **3** · D **143** = **186**.
D = 28 by the LY>0/TY=0 rule + **115 fallback**. Listings shown 186 = Total 186.

### Read D with care

115 of the 143 D rows are fallback, and **109 of those sold nothing in EITHER September** — they
never performed rather than lost performance. The business chose this labelling; the dashboard says
so plainly in the D tooltip and the Data Notes rather than letting the badge overstate the finding.
**Do not read the D count as lost revenue.** The six substantive fallback rows (still selling, still
advertising, down YoY, not recovering — including control SKU 164525233292) are the ones worth
acting on; they are indistinguishable from dormant stock by segment alone.

### Traps

19. **Gate 8's premise changed, and was rewritten rather than loosened.** It asserted "every D has
   LY>0 and TY=0", which the fallback legitimately breaks. It now asserts the real contract: a D row
   is *either* rule-D *or* matches none of A/B/C — so a D that should have been A/B/C still fails.
20. **Never reintroduce a view-level segment filter.** Gate 50 asserts the ABSENCE of
   `DATA = SOURCE.filter(...)` in both index.html and the packaged standalone, and
   `build/standalone.mjs` throws on it. That filter is exactly how 115 products vanished.
21. **`build/build.mjs` throws if any row is not A/B/C/D.** If you add a branch, extend the
   contract — do not relax the guard.

### Gates added/reworked

8 (D = rule or fallback) · 49 (every product classified, A+B+C+D = row count, 0 hidden) ·
50 (page hides nothing; no view filter, no Other option — checked in source AND standalone) ·
51 (cards A/B/C/D, Total = all rows) · 52 (classification moved no metric — re-checked vs raw) ·
53 (fallback correctness: unmatched → D, A/B/C never overridden) ·
**54 + 54b regression: control SKU 164525233292 present, intact, classified, and embedded in the
published standalone** — so it can never silently disappear again.
