> **SUPERSEDED 2026-09-30 by `validation/final-raw-data-audit-2026-09-30.md`.**
> That audit re-extracted every metric from raw. The Orders DEFINITION below still stands, but
> its figures (TY Orders 132, the 2026-09-29 10:27:17 timestamp bound, the side-car evidence
> file) belong to the superseded snapshot. TY Orders is now **133** on a full-month window, and
> Orders is derived inside `sql/i-fresh-authoritative.sql` rather than from a side-car.
> Kept as the record of how the Orders defect was found and fixed.

# Actual Orders fix — validation record

**Date:** 2026-09-30 · **Scope:** LY Orders and TY Orders only · **Source:** fresh `ledsone`
@ 169.58.91.229:5432, `dbhub_readonly`, SELECT only.

## 1. The defect

LY/TY Orders were `business_reports.ebay_traffic_data.quantity_sold` — eBay-reported **units
sold**, i.e. traffic-side quantity. One customer order buying three units published as three
"Orders". The column is labelled Orders and read by the business as orders, so the published
number did not mean what its own header said.

## 2. Actual Orders source

```sql
Orders = COUNT(DISTINCT order_management.orders.order_id)
FROM order_management.orders o
JOIN order_management.order_item_info oii ON oii.order_id = o.id
JOIN order_management.sub_source ss       ON ss.id = o.sub_source_id
JOIN order_management.source s            ON s.id = ss.source_id AND s.source_name = 'EBAY'
grouped by o.sub_source_id + oii.item_id + marketplace
WHERE o.status NOT IN ('Cancelled','Refunded')
  AND o.order_id IS NOT NULL AND TRIM(o.order_id) <> ''
```

Query `sql/h-actual-orders.sql` · evidence `evidence/extract-2026-09-29-fresh/actual-orders.json`

- `item_quantity` is **not** summed into Orders.
- `ebay_traffic_data.quantity_sold` is **not** read as Orders.
- Cancelled and Refunded are excluded — the same filter Sales already uses, so Orders and
  Sales agree on what a realised order is.

**`order_id` validity, verified before use.** Across both September windows: 13,018 order
rows, 13,018 distinct `order_id`, **0 blank, 0 `'0'`** — `order_id` is 1:1 with `orders.id`,
so the DISTINCT hides no de-duplication artefact.

## 3. Windows

| | From | To |
|---|---|---|
| LY | 2025-09-01 00:00:00 | 2025-09-30 23:59:59 (full month) |
| TY | 2026-09-01 00:00:00 | **2026-09-29 10:27:17** |

The TY bound is the instant the pack G Sales snapshot was taken, not end-of-day, so Orders
and Sales share one window. **Proven, not assumed:** recomputing LY/TY Sales and LY/TY OMS
units from raw orders with this bound reproduces the pack G snapshot on all 186 rows with
**0 differences** and **0 orphan grains**. Counting to end-of-day 2026-09-29 would add order
`24-15218-31602` (item 266004810103, GBP 27.78, placed 11:59:41) which the Sales snapshot does
not contain — the dashboard would then show Orders 1 against Sales 0.00 on that row.

The three 09-29 orders the snapshot *does* contain (00:36, 09:11, 10:20) sum to GBP 51.67,
which is exactly the gap between raw sales-to-09-28 (2,455.89) and the published TY Sales
(2,507.56). That arithmetic is how the cutoff was located.

## 4. Control check — verified from raw order records

eBay ID **164525233292** (Ledsone, `sub_source` 1, GB), September 2025:

| | |
|---|---|
| order lines | 66 |
| **distinct `order_id`** | **62** ✓ expected 62 |
| `quantity_sold` (old Orders) | 83 |
| OMS `item_quantity` | 94 |
| statuses present | Completed only (no Cancelled/Refunded in this slice) |

Checked against raw records **before** any rebuild.

## 5. Reconciliation — 13 eBay IDs, all six accounts

Counts pulled with a deliberately **different query shape** from pack H —
`ARRAY_LENGTH(ARRAY_AGG(DISTINCT order_id))` instead of `COUNT(*) FILTER` over a DISTINCT
pre-pass — so agreement is not self-confirming.

| eBay ID | Account | Mkt | LY dash/raw | TY dash/raw | lines LY/TY | units LY/TY |
|---|---|---|---|---|---|---|
| 164525233292 | Ledsone | GB | 62 / 62 ✓ | 21 / 21 ✓ | 66 / 23 | 94 / 39 |
| 166598501724 | Ledsone | GB | 30 / 30 ✓ | 6 / 6 ✓ | 30 / 6 | 30 / 6 |
| 164006555006 | Ledsone | GB | 14 / 14 ✓ | 1 / 1 ✓ | 14 / 1 | 16 / 2 |
| 165074694177 | Ledsone | GB | 0 / 0 ✓ | 12 / 12 ✓ | 0 / 12 | 0 / 15 |
| 164897638505 | ledsone uk de | DE | 4 / 4 ✓ | 0 / 0 ✓ | 4 / 0 | 10 / 0 |
| 164152801706 | ledsone uk de | DE | 1 / 1 ✓ | 0 / 0 ✓ | 1 / 0 | 2 / 0 |
| 315791126257 | Sunsone | GB | 2 / 2 ✓ | 0 / 0 ✓ | 2 / 0 | 2 / 0 |
| 316914051271 | Sunsone | GB | 1 / 1 ✓ | 2 / 2 ✓ | 1 / 2 | 1 / 2 |
| 266929449611 | Electricalsone | GB | 1 / 1 ✓ | 5 / 5 ✓ | 1 / 7 | 1 / 13 |
| 267396708861 | Electricalsone | GB | 0 / 0 ✓ | 10 / 10 ✓ | 0 / 10 | 0 / 14 |
| 267519662345 | Electricalsone | GB | 0 / 0 ✓ | 0 / 0 ✓ | 0 / 0 | 0 / 0 |
| 405328319833 | ledsone de | DE | 1 / 1 ✓ | 0 / 0 ✓ | 1 / 0 | 4 / 0 |
| 394108402532 | Huttenlampen | DE | 1 / 1 ✓ | 1 / 1 ✓ | 1 / 1 | 2 / 1 |

**13 IDs × 2 windows = 26 checks · 0 failures · 6 of 6 accounts covered.**

`267519662345` is included on purpose: an assigned product with no orders at all, confirming
a published 0 is a real zero and not a lookup miss.

Note the rows where lines > distinct orders (164525233292: 66→62 and 23→21; 266929449611:
7→5) — this is the defect made visible: those are multi-line orders that used to inflate the
Orders column.

## 6. What changed, and what did not

Field-by-field diff of all 186 rows against the pre-fix dataset:

| Field | Rows changed |
|---|---|
| `ly_orders` | 26 |
| `ty_orders` | 23 |
| `ly_qty_sold`, `ty_qty_sold` | 186 (**new** audit fields — the STR numerator, not displayed) |
| **everything else** | **0** |

| Metric | Pre-fix | Post-fix |
|---|---|---|
| LY Orders (all rows) | 235 | **185** |
| TY Orders (all rows) | 197 | **132** |
| LY Sales / TY Sales | 3,182.15 / 2,507.56 | 3,182.15 / 2,507.56 |
| LY Views / TY Views | 8,487 / 6,184 | 8,487 / 6,184 |
| Ad Impressions / Clicks / Spend | 1,556,049 / 2,041 / 288.28 | 1,556,049 / 2,041 / 288.28 |
| Segments | D 29 · A 38 · B 1 · C 3 · Other 115 | D 29 · A 38 · B 1 · C 3 · Other 115 |
| Rows · currencies | 186 · GBP 157 / EUR 29 | 186 · GBP 157 / EUR 29 |

The old `ly_orders`/`ty_orders` values equal the new `ly_qty_sold`/`ty_qty_sold` on **every**
row — confirming the pre-fix column was exactly `quantity_sold` and nothing else was disturbed.

Preserved unchanged: Sales · YoY · Views · Conversion · Avg Price · all ad metrics · SKU
Image · SKU ID · Category · Segments · filters · Download · full product and account scope.

## 7. Conversion % — deliberately NOT changed

Conversion remains `ebay_traffic_data.quantity_sold / ebay_views × 100`, which is
algebraically eBay's own reported `str`. It is **not** recomputed from distinct Orders —
that would publish a rate eBay never reports. Gate 41b holds it byte-identical to the pre-fix
dataset: **all 186 rows unchanged**.

Orders and Conversion therefore have different numerators by design, and both the dashboard's
metric notes now say so explicitly.

## 8. Gates

| Gate | Asserts | Result |
|---|---|---|
| 40 | every row's Orders equals the **raw evidence file**, re-read independently of the build | PASS |
| 40b | `Orders ≤ OMS units` — same source, same window | PASS (186/186) |
| 40c | control `164525233292` LY Orders **= 62** | PASS |
| 40d | Orders differs from `quantity_sold` *and* from OMS units — not a relabelled units column | PASS |
| 41 | Conversion = `quantity_sold / views`, **not** distinct Orders / views | PASS (186/186) |
| 41b | Conversion byte-identical to the pre-fix baseline | PASS (186/186) |

**All gates pass — 52 numbered gates plus the coverage check, 53 PASS, 0 FAIL.**

### One gate premise was corrected, not loosened

The first draft of gate 40b asserted `Orders ≤ quantity_sold` as well. It failed on 11 rows —
correctly. `quantity_sold` comes from a separate eBay traffic feed whose September coverage is
incomplete (LY 28 of 30 days, TY 27 days), while the order source covers every day, so on
those rows the traffic feed reports **fewer** units than there were real orders. The premise
was false, so it was removed and replaced with the invariant that genuinely holds
(`Orders ≤ OMS units`, same source and window) plus gate 40d. No tolerance was widened.

## 9. Dashboard QA

Headless render of `September-Comparison-Dashboard.html`:

- HTTP 200 · 186 rows rendered · 30 columns · **0 console errors · 0 failed requests**
- Control row `164525233292` in the rendered DOM: **LY Orders 62 · TY Orders 21** ·
  LY Conv **2.72%** · LY Sales £1,210.05 · TY Sales £515.21
- Metric notes updated: Orders now described as distinct customer orders; Conversion
  explicitly documented as still units-based (eBay STR). The old
  "Orders is eBay's own reported units sold" claim is gone.

Standalone: 191,868 chars.

## 10. Files touched

| File | Change |
|---|---|
| `sql/h-actual-orders.sql` | **new** — the Actual Orders query |
| `evidence/extract-2026-09-29-fresh/actual-orders.json` | **new** — raw distinct-order evidence, 77 grains |
| `validation/conversion-baseline-prefix.json` | **new** — frozen pre-fix Conversion %, 186 rows, read by gate 41b |
| `build/build.mjs` | extract cols 25/26 renamed `LY_QTY`/`TY_QTY` (Conversion only); Orders read from the side-car; `ly_qty_sold`/`ty_qty_sold` added; `meta.metric_sources` corrected |
| `build/validate.mjs` | gate 40 rewritten to re-read raw evidence; gates 40b/40c/40d/41b added; gate 41 moved onto `*_qty_sold` |
| `index.html` | metric notes corrected — Orders is distinct orders, Conversion is still units-based |
| `data/september-comparison.json` | rebuilt |
| `September-Comparison-Dashboard.html` | repackaged, 191,868 chars, md5 `a479448e8327d70ba699379a8f2450f5` |
| `validation/metric-contract.md`, `AI-CONTEXT.md`, `handover/current-state.md` | contract and handover updated |

No dashboard columns were added, removed or reordered (30 columns before and after). The CSV
export column list is unchanged — `ly_qty_sold`/`ty_qty_sold` are dataset audit fields only.

## 11. Publication

`tech_team_outputs.ph_task` row **1947** updated — `html_content` and `updated_at` only,
one transactional UPDATE, no INSERT.

| | |
|---|---|
| before | 184,803 chars · md5 `233bad16f5cb7c9660d38729a45a4632` |
| after | **191,868 chars · md5 `a479448e8327d70ba699379a8f2450f5`** (= source file) |
| identity | `assigned_user = utharsika` · `assigned_user_team = ph_priors` |
| rows for `project_code = september-comparison` | **1** (unchanged — no duplicate) |

Verified after commit by an independent read of the stored row: stored length and MD5 match
the source byte-for-byte, the distinct-orders note is present, and the old
"Orders is eBay's own reported units sold" text is absent.

No Git commit and no Git push were made.
