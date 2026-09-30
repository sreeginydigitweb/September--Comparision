# Final Raw Data Audit — 2026-09-30

**Mandate:** audit and correct every dashboard metric against fresh raw LEDSone records, not
against the dashboard itself. **Source of truth:** fresh `ledsone` @ `169.58.91.229:5432`,
`dbhub_readonly`, **SELECT only**. **Result: all gates pass, 565 raw checks, 0 failures,
published to PH row 1947.**

---

## 1. Control evidence reproduced from raw

eBay ID **164525233292** (Ledsone, `sub_source` 1, GB), September 2025 — verified from raw
order records **before** any rebuild, and again in the finished dashboard:

| Measure | Senior-supplied | Raw LEDSone | Dashboard | Result |
|---|---|---|---|---|
| Actual distinct orders | 62 | **62** | **62** | PASS |
| Order lines | 66 | **66** | 66 | PASS |
| Units sold | 94 | **94** | 94 | PASS |
| Actual realised revenue | £1,210.05 | **£1,210.05** | **£1,210.05** | PASS |
| Cancelled / Refunded | 0 | **0** | — | PASS |

`ly_sales` was **not** changed to £1,213.05. Raw line-level aggregation gives 1,210.05 exactly;
no additional valid revenue exists for this item in the window.

Full control reconciliation against raw:

| Metric | Raw | Dashboard |
|---|---|---|
| TY Sales | 515.21 | 515.21 |
| TY Orders | 21 | 21 |
| LY / TY Views | 3,056 / 778 | 3,056 / 778 |
| LY / TY Conversion % | 2.72 / 5.14 | 2.72 / 5.14 |
| LY / TY Avg Price | 12.87 / 13.21 | 12.87 / 13.21 |
| Ad Impressions | 90,146 | 90,146 |
| Ad Clicks | 290 | 290 |
| Ad Spend | 53.53 | 53.53 |
| LY Ad-Generated / Non-Ad | 1,210.05 / 0.00 | 1,210.05 / 0.00 |
| TY Ad-Generated | not available | **Pending** |

Note the three different numbers that are easy to conflate: **Orders 62 · `quantity_sold` 83 ·
units 94**. They are not interchangeable.

---

## 2. Structural change: one query, no side-cars

Every metric now derives from **`sql/i-fresh-authoritative.sql`** — a single 33-column extract.
Pack G, pack H, `ly-sku-ad-split.json` and `actual-orders.json` are out of the build path.

This was not tidying. A frozen side-car had **already drifted** from the query meant to
reproduce it, which is how defect 2 below was found. One snapshot, one query, nothing to drift.

Evidence set: **`evidence/extract-2026-09-30-final/`**
(`pack-i-extract.json`, `sales-reconciliation.json`, `utharsika-ebay-allowlist.json`)

---

## 3. Defects found in raw and corrected

### 3.1 Orders meant units

`LY/TY Orders` read `business_reports.ebay_traffic_data.quantity_sold` — eBay-reported **units
sold**. An order buying 3 units published as 3 "Orders".

```
Orders = COUNT(DISTINCT order_management.orders.order_id)
         via order_item_info, at account + eBay item_id + marketplace
         EBAY source · status NOT IN ('Cancelled','Refunded') · order_id non-blank
```

`item_quantity` is never summed into Orders. `quantity_sold` is never read as Orders. Order-line
count is never Orders.

**`order_id` validity, verified before use:** across both September windows — 13,018 order rows,
13,018 distinct `order_id`, **0 blank, 0 `'0'`** — 1:1 with `orders.id`, so the DISTINCT hides
no de-duplication artefact.

### 3.2 LY Ad-Generated was understated by £14.29

The AD_FEE query filtered fees to `transaction_date` within September 2025. eBay bills on its
own clock: order **`11-13519-57563`** was placed **2025-09-01** but its AD_FEE was billed
**2025-08-31** — a day *before* the sale — so the order was silently dropped. Item
**164043595851** read **231.98** instead of **246.27**.

The fee date is a billing artefact. Attribution is proven by the `(order_id, item_id)` pair, and
the join to the September order population already scopes the period. The window was removed and
the scan bounded by a semi-join to that population instead.

Checked across the whole order population: **0 rows where ad-generated exceeds the item's own
realised sales**, so removing the window cannot over-attribute. LY Ad-Generated is back to
**2,952.12**, now derived in-query rather than read from a frozen file.

---

## 4. Field-by-field audit outcome

### Corrected (definition or logic was wrong)

| Field | Was | Now |
|---|---|---|
| **LY Orders** | 235 (`quantity_sold`) | **185** (distinct orders) |
| **TY Orders** | 197 (`quantity_sold`) | **133** (distinct orders) |
| **LY Ad-Generated** | 2,937.83 under the fee-date window | **2,952.12** |
| **LY Non-Ad-Attributed** | 244.32 (derived from the above) | **230.03** |

### Refreshed to the current snapshot (definition already correct)

TY Sales 2,507.56 → **2,535.34** · TY Views 6,184 → **6,404** · TY Conversion % (traffic gained
2026-09-28) · TY Avg Price · Ad Impressions 1,556,049 → **1,594,442** · Ad Clicks 2,041 →
**2,094** · Ad Spend 288.28 → **295.26** · Ad Sales · ROAS/ACoS · YoY % · Segments
(D 29→28, B 1→2 as fresh TY sales arrived).

### Already correct, re-verified against raw and unchanged

LY Sales **3,182.15** · LY Views **8,487** · LY Conversion % · LY Avg Price · LY Ad Sales ·
LY Units 259 · eBay ID · SKU Image · SKU ID · Category · SKU/Product · row count 186 ·
six accounts · GBP 157 / EUR 29.

### Remaining unverified — deliberately

| Field | Why | Shown as |
|---|---|---|
| **TY Ad-Generated** | eBay AD_FEE billing reaches only **2026-09-03** (3 of 29 TY days) | **Pending** |
| **TY Non-Ad-Attributed** | derived from the above | **N/A** |
| **TY Ad Sales %** | derived from the above | **N/A** |

Computing these would publish a figure a reader interprets as "almost no TY sales came from
ads", which is false. `0` reads as "no ad sales"; `null` reads as "not yet known" — the truth.

---

## 5. Raw reconciliation — 20 IDs, 0 failures

Pulled per-ID with a query **structurally independent** of the extract, so agreement is not
self-confirming. Derived metrics (YoY, Conversion, Price, ROAS/ACoS, Segment) were **recomputed
from raw**, never read from the dataset.

| # | eBay ID | Account | Mkt | Category | Seg | Why this row |
|---|---|---|---|---|---|---|
| 1 | 164525233292 | Ledsone | GB | Lamp Shade | Other | **CONTROL** · multi-qty · multi-line |
| 2 | 164043595851 | Ledsone | GB | Lamp Shade | Other | LY ad split partial (the £14.29 defect) |
| 3 | 166598501724 | Ledsone | GB | **Wall Plug** | Other | Wall Plug with sales |
| 4 | 166748372610 | Ledsone | GB | **Wall Plug** | Other | Wall Plug, **zero sales** |
| 5 | 166598283141 | Ledsone | GB | Wall Plug | **C** | segment C |
| 6 | 166596769613 | Ledsone | GB | Lamp Shade | **B** | segment B (7-day window verified) |
| 7 | 163037863571 | Ledsone | GB | Lamp Shade | **D** | segment D |
| 8 | 163225404503 | Ledsone | GB | Lamp Shade | **A** | segment A |
| 9 | 163617109673 | Ledsone | GB | Lamp Shade | A | **sales but NO ads** |
| 10 | 163605069793 | Ledsone | GB | Lamp Shade | Other | zero sales |
| 11 | 317866396609 | **Sunsone** | GB | Lamp Shade | A | account top seller |
| 12 | 313605234632 | Sunsone | GB | Lamp Shade | Other | zero sales |
| 13 | 266929449611 | **Electricalsone** | GB | Lamp Shade | A | multi-line (7 lines → 5 orders) |
| 14 | 265232354037 | Electricalsone | GB | Lamp Shade | Other | zero sales |
| 15 | 394108402532 | **Huttenlampen** | DE | Lamp Shade | C | account top seller |
| 16 | 394107366804 | Huttenlampen | DE | Lamp Shade | Other | zero sales |
| 17 | 164897638505 | **ledsone uk de** | DE | Lamp Shade | D | account top seller |
| 18 | 164048116338 | ledsone uk de | DE | Lamp Shade | Other | zero sales, ads but no sales |
| 19 | 405328319833 | **ledsone de** | DE | Lamp Shade | D | account top seller |
| 20 | 405328319890 | ledsone de | DE | Lamp Shade | Other | zero sales |

**26 metrics per ID** — LY/TY Sales, YoY %, YoY label, LY/TY Ad Sales, LY/TY Views, LY/TY Orders,
LY/TY Conversion %, LY/TY Price, Ad Impressions, Ad Clicks, Ad Spend, Ad Sales, ROAS, ACOS,
LY Ad-Generated, LY/TY Units, LY/TY Order Lines, Segment.

```
20 IDs x 26 metrics                = 520 checks, 0 failures
supporting fields (6 IDs x 7)      =  42 checks, 0 failures
Segment B 7-day windows            =   3 checks, 0 failures
--------------------------------------------------------
TOTAL                              = 565 raw checks, 0 FAILURES
```

Coverage: **6 of 6 accounts** · both categories · all five segment values · sales · zero sales ·
multiple quantities per order · multi-line orders collapsed to one order · ads · no ads.

Full matrix in the required shape (Account · eBay ID · Metric · Raw LEDSone Value · Dashboard
Value · Difference · Result): **`validation/raw-reconciliation-2026-09-30.csv`** — 520 rows.

### Segment B proven from raw

Anchor = latest TY order date for the assigned population, **2026-09-29**.

| eBay ID | last 7 days | preceding 7 | last7 > prev7 | Segment | Correct |
|---|---|---|---|---|---|
| 166596769613 | 14.89 | 0.00 | **true** | **B** | yes |
| 164525233292 | 68.55 | 207.25 | false | Other | yes |
| 166598501724 | 9.89 | 17.97 | false | Other | yes |

---

## 6. No regression

| Preserved | Verified |
|---|---|
| utharsika product scope | 186 assigned IDs, MD5 `4e23f0b308d204b65a21d37a269229a7` — **identical** to the 2026-09-29 capture |
| Lamp Shade / Wall Plug only | 173 / 13; gate 37 confirms no bulbs/transformers/drivers |
| Six accounts | Electricalsone 21 · Huttenlampen 9 · Ledsone 92 · Sunsone 44 · ledsone de 6 · ledsone uk de 14 |
| No cross-account aggregation | grain `account + item + marketplace`; gate 2 confirms uniqueness |
| SKU Image | 184 / 186 (2 listings genuinely have none) |
| SKU ID | 186 / 186 |
| Category filter | always offers All / Lamp Shade / Wall Plug |
| Filters | Account, Category, Segment, Currency (GBP — UK / EUR — DE) all present |
| TOTAL row | present |
| Download CSV | enabled, "Download CSV (186)" |
| Standalone UI / scrolling / UX | unchanged; 30 columns before and after |
| Currencies never summed | GBP 157 / EUR 29 kept separate |

Row count 186 → 186. No row multiplication.

---

## 7. Dashboard and CSV both equal the raw data

Headless render of `September-Comparison-Dashboard.html`:

- HTTP 200 · **186 rows** · 30 columns · **0 console errors · 0 failed requests**
- Control row in the rendered DOM: LY Sales **£1,210.05** · LY Orders **62** · TY Sales £515.21 ·
  TY Orders 21 · Views 3,056 / 778 · Conv 2.72% / 5.14% · Price £12.87 / £13.21 ·
  Impressions 90,146 · Clicks 290 · Spend £53.53 · ROAS 3.22 · 31.0% · Segment Other ·
  SKU ID `LSCY210BG+RPR44WH` · Category Lamp Shade · TY Ad-Generated **Pending** · image renders
- **CSV export = dashboard data**: 187 lines (header + 186), 31 columns; the control row exports
  `…,1210.05,1210.05,0.00,100.0,515.21,Pending,N/A,N/A,-57.4,…,3056,778,62,21,2.72,5.14,…`

---

## 8. Gates

`npm run validate` — **ALL GATES PASSED** (52 numbered gates + coverage check).

New or reworked in this audit:

| Gate | Asserts |
|---|---|
| 40 | Orders equals the **raw extract**, re-read directly — not just build output |
| 40c | control: LY Orders 62 **and** LY Sales 1,210.05 **and** lines 66 **and** units 94 |
| 40e | `Orders ≤ order lines`, and multi-line orders demonstrably collapse |
| 41b | **LY regression guard** — replaces an expired premise (see below) |
| 41c | **every published field on every row equals the raw extract** — 186 × 16 = **2,976 checks** |

`build/build.mjs` throws before writing if any row has `orders > units`, `orders > lines`, or
`ly_ad_generated > ly_sales`, or if any extract row is not 33 columns wide.

### A gate premise expired and was replaced, not loosened

The previous gate 41b froze TY Conversion % against the pre-Orders-fix dataset. That premise
died with this re-extract: TY traffic gained 2026-09-28, so TY Conversion **must** move. Keeping
the gate would have forced the dashboard to publish a stale rate. It is now an **LY regression
guard** — LY September 2025 is closed data and is asserted as absolutes: Sales 3,182.15 ·
Orders 185 · Views 8,487 · Units 259 · Ad-Generated 2,952.12.

Separately, an earlier `Orders ≤ quantity_sold` assertion failed correctly on 11 rows: the
traffic feed's September coverage is incomplete, so it can report fewer units than there were
real orders. The **premise** was removed, not the tolerance.

---

## 9. Source coverage at audit time

| Source | LY max | TY max | TY days |
|---|---|---|---|
| `orders` (all eBay) | 2025-09-30 | 2026-09-30 03:30 | 30 |
| `orders` (assigned population) | 2025-09-30 | **2026-09-29** | 29 |
| `ebay_traffic_data` | 2025-09-30 (28 days) | **2026-09-28** | 28 |
| `listing_performance` | 2025-09-30 | **2026-09-30** | 30 |
| AD_FEE | 2025-09-30 | **2026-09-03** | 3 |

Each TY source ends on its own day. Published in `meta.source_max_dates` and shown in the
dashboard note — not smoothed over.

---

## 10. Publication

`tech_team_outputs.ph_task` row **1947** — `html_content` and `updated_at` only, **one**
transactional UPDATE, **no INSERT**.

| | |
|---|---|
| before | 191,868 chars · md5 `a479448e8327d70ba699379a8f2450f5` |
| **after** | **200,181 chars · md5 `652e087fae3ea522cd9643d1aa694937`** |
| **standalone file hash** | **`652e087fae3ea522cd9643d1aa694937`** — **identical** |
| identity | `assigned_user = utharsika` · `assigned_user_team = ph_priors` |
| rows for `project_code = september-comparison` | **1** (unchanged — no duplicate) |
| `updated_at` | 2026-09-30 08:46:43 +05:30 |

Verified after commit by an independent read of the stored row: stored length and MD5 match the
source byte-for-byte, the distinct-orders note and the 185/133 totals are present, and the stale
"TY 27 available days" text is absent.

**LEDSone was read SELECT-only throughout. No Git commit, no Git push.**

---

## 11. Files

| File | Change |
|---|---|
| `sql/i-fresh-authoritative.sql` | **new** — the single authoritative 33-column extract |
| `evidence/extract-2026-09-30-final/` | **new** — pack I extract, fresh independent reconciliation, allowlist |
| `build/build.mjs` | consumes pack I; side-cars removed; LY split derived from the extract; width + invariant guards |
| `build/validate.mjs` | evidence repointed; gates 40/40c/40e/41b/41c reworked; misleading gate-20 label fixed |
| `index.html` | metric notes corrected (Orders definition, totals, coverage dates, audit date) |
| `data/september-comparison.json` | rebuilt |
| `September-Comparison-Dashboard.html` | repackaged, 200,181 chars |
| `validation/metric-contract.md` | **rewritten** as the full data contract (Field · Meaning · Raw Source · Raw Column · Aggregation · Window · Grain) |
| `validation/raw-reconciliation-2026-09-30.csv` | **new** — 520-row raw-vs-dashboard matrix |
| `validation/final-raw-data-audit-2026-09-30.md` | **new** — this record |
| `AI-CONTEXT.md`, `handover/current-state.md` | updated with the new contract, figures and traps |
| `sql/g-*.sql`, `sql/h-*.sql` | superseded, retained for history |
