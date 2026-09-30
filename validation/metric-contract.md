# Metric contract — the single source of truth

**Version:** 2026-09-30 (FINAL RAW DATA AUDIT). Supersedes every earlier version of this file.
**Source of truth:** fresh `ledsone` @ `169.58.91.229:5432`, user `dbhub_readonly`, **SELECT only**.
**Extract:** `sql/i-fresh-authoritative.sql` — ONE 33-column query. Every published metric comes
from it, so no side-car evidence file can drift from the dashboard.
**Evidence:** `evidence/extract-2026-09-30-final/`

Read this before changing any field. If a value is questioned, go to the raw source named here —
never to another dashboard field, and never to a previous version of this document.

---

## 1. Why this version exists

The previous contract had two defects, both found by going back to raw records:

1. **Orders meant units.** `LY/TY Orders` read `ebay_traffic_data.quantity_sold` — eBay-reported
   units sold. An order buying 3 units published as 3 "Orders". Corrected to
   `COUNT(DISTINCT order_id)`.
2. **LY Ad-Generated was understated by £14.29.** The AD_FEE query filtered fees to September
   2025 `transaction_date`. eBay bills on its own clock: order `11-13519-57563` was placed
   2025-09-01 but billed **2025-08-31**, so that order was silently dropped. The fee date is a
   billing artefact and must not scope attribution — the `(order_id, item_id)` pair does.

Both are fixed here and enforced by gates.

---

## 2. Control evidence — authoritative

eBay ID **164525233292** (Ledsone, `sub_source` 1, GB), September 2025. Independently verified
from raw LEDSone records **before** any rebuild:

| Measure | Value |
|---|---|
| Order lines | **66** |
| **Actual distinct orders** | **62** |
| Units sold (OMS `item_quantity`) | **94** |
| eBay `quantity_sold` | 83 |
| **Actual realised revenue** | **£1,210.05** |
| Cancelled / Refunded in scope | **0** |

Three different numbers — 62, 83, 94 — that a careless reading treats as interchangeable. They
are not. Orders is 62.

---

## 3. THE DATA CONTRACT

Grain for every row: **account + eBay item_id + marketplace**. Currencies are never summed
together. Accounts are never blended.

| Field | Business meaning | Raw source | Raw column | Aggregation | Date window | Grain |
|---|---|---|---|---|---|---|
| **eBay ID** | the eBay listing | `listings.ebay_listings` | `item_id` | key | n/a | account + item + mkt |
| **SKU / Product** | what the listing sells | `listings.ebay_listings` | `sku`, `parent_sku`, `title` | `MIN(sku)`; if >1 variation, `parent_sku (N variations)` | n/a | " |
| **SKU ID** | the listing's own SKU | `listings.ebay_listings` | `sku` | `MIN(sku)` where `all_list=1` | n/a | " |
| **SKU Image** | listing main image | `listings.ebay_listings` | `main_image_url` | `MIN(...)`, `http→https` | n/a | " |
| **Category** | PH category | `staff.ph_categories` + `ph_category_products` | `pc.id` 66/67 | 66→Lamp Shade, 67→Wall Plug; **both → Wall Plug** | n/a | item |
| **LY Sales** | realised revenue of the purchased item | `order_management.orders` × `order_item_info` | `item_quantity`, `item_price` | `SUM(item_quantity × item_price)` | 2025-09-01 → 2025-09-30 | account + item + mkt |
| **TY Sales** | " | " | " | " | 2026-09-01 → 2026-09-30 (data ends 09-29) | " |
| **LY / TY Orders** | **actual distinct customer orders** | `order_management.orders` × `order_item_info` | `orders.order_id` | **`COUNT(DISTINCT order_id)`** | as Sales | " |
| **LY / TY Units** *(audit)* | units sold | " | `item_quantity` | `SUM` | as Sales | " |
| **LY / TY Order Lines** *(audit)* | line count | " | — | `COUNT(*)` | as Sales | " |
| **YoY %** | growth on Total Sales | derived | — | `(TY−LY)/LY×100`; LY=0 & TY>0 → `NEW`; both 0 → `N/A` | — | row |
| **LY Views** | eBay listing page views | `business_reports.ebay_traffic_data` | `ebay_views` | `SUM`; `external_views` **excluded** | 2025-09-01 → 2025-09-30 (28 of 30 days present) | sub_source + item + site_code |
| **TY Views** | " | " | " | " | 2026-09-01 → **2026-09-28** | " |
| **LY / TY Conversion %** | **eBay STR — units-based, unchanged** | `ebay_traffic_data` | `quantity_sold`, `ebay_views` | `quantity_sold / ebay_views × 100` | as Views | " |
| **LY / TY Avg Price** | Average Selling Price | derived | — | `Sales ÷ Units` — **labelled fallback, not a listing price** | as Sales | row |
| **LY Ad-Generated** | of the item's own sales, the part an ad produced | `accounting.ebay_order_expenses` × `orders` × `order_item_info` | `fee_type='AD_FEE'`, `order_id`, `item_id` | DISTINCT `(order_id,item_id)` → **that order line's revenue**, never the fee. **No fee-date window** | order date 2025-09 | account + item + mkt |
| **LY Non-Ad-Attributed** | remainder | derived | — | `LY Sales − LY Ad-Generated` | " | row |
| **TY Ad-Generated / Non-Ad / Ad %** | same, TY | `ebay_order_expenses` | — | **`null` → "Pending" / "N/A"** | AD_FEE ends **2026-09-03** | row |
| **LY / TY eBay Attributed Ad Sales**, **Ad Sales** | click-attributed revenue credited to the **clicked** listing | `ebay_campaigns.listing_performance` | `sale_amount_listing_currency` | `SUM`, aggregated before join | LY 2025-09 · TY 2026-09 (→09-30) | campaign sub_source + listing + mkt |
| **Ad Impressions** | promoted-listing impressions | `listing_performance` | `impressions` | `SUM` — *not* traffic-report impressions | TY 2026-09 → 09-30 | " |
| **Ad Clicks** | promoted clicks | `listing_performance` | `clicks` | `SUM` | " | " |
| **Ad Spend** | eBay ad-performance fees | `listing_performance` | `ad_fees_listing_currency` | `SUM` | " | " |
| **ROAS / ACoS** | ad efficiency | derived | — | `SUM(ad_sales)/SUM(ad_spend)` — **never an average of row-level rates** | TY | row |
| **Segment** | A/B/C/D | derived | — | strict precedence **D → C → B → A**, with **D as the catch-all** so no product is ever unclassified or hidden | TY vs LY | row |
| **Currency** | selling currency | derived from marketplace | — | `GB→GBP`, `DE→EUR` | n/a | row |

### Segment rules (V1 operational definitions)

| | Rule |
|---|---|
| **D** | LY Sales > 0 **and** TY Sales **exactly** 0 — **and the FALLBACK**: any product matching none of A/B/C is D |
| **C** | LY Attributed Ad Sales > 0 **and** TY Attributed Ad Sales = 0 |
| **B** | TY Sales < LY Sales **and** last 7 TY days > preceding 7 TY days (anchored on the latest TY order date, 2026-09-29) |
| **A** | TY Sales > LY Sales |


---

## 4. What Orders is NOT

```
Orders  ≠  ebay_traffic_data.quantity_sold      (eBay units sold)
Orders  ≠  order_item_info.item_quantity        (OMS units)
Orders  ≠  COUNT(*) of order lines              (line count)
Orders  =  COUNT(DISTINCT orders.order_id)
```

Valid `order_id`: NOT NULL and not blank. Verified across both September windows — **13,018
order rows, 13,018 distinct `order_id`, 0 blank, 0 `'0'`** — so `order_id` is 1:1 with
`orders.id` and the DISTINCT conceals no de-duplication artefact.

Excluded statuses: **Cancelled, Refunded** — the same filter Sales uses, so Orders and Sales
always agree on which orders are real.

**Totals caveat.** Summing the Orders column across rows sums **per-listing** order counts: one
order containing two different assigned listings contributes 1 to each row. The column total is
therefore not a portfolio-level distinct-order count. This is inherent to a per-listing report.

---

## 5. Conversion % stays units-based — deliberately

Conversion remains `quantity_sold / ebay_views × 100`, which is algebraically eBay's own
reported `str`. It is **not** recomputed from distinct Orders, because that would publish a rate
eBay never reports and the business could not tie back to Seller Hub.

**Orders and Conversion have different numerators by design.** `LY Orders = 62` does **not**
imply `Conversion = 62 / Views`. `ly_qty_sold` / `ty_qty_sold` are carried in the dataset as the
STR numerator — audit fields, not displayed columns.

`Orders ≤ quantity_sold` is **not** a valid invariant and is not asserted: the traffic feed's
September coverage is incomplete (LY 28 of 30 days, TY 28), so on some rows it reports fewer
units than there were real orders. The gates assert `Orders ≤ Units` and `Orders ≤ Lines`
instead — same source, same window.

---

## 6. Source coverage, re-verified 2026-09-30

| Source | LY max | TY max | TY days | Consequence |
|---|---|---|---|---|
| `order_management.orders` (all eBay) | 2025-09-30 | 2026-09-30 03:30 | 30 | — |
| `order_management.orders` (assigned population) | 2025-09-30 | **2026-09-29** | 29 | TY Sales/Orders partial |
| `ebay_traffic_data` | 2025-09-30 (28 days) | **2026-09-28** | 28 | Views/Conversion partial both sides |
| `ebay_campaigns.listing_performance` | 2025-09-30 | **2026-09-30** | 30 | ad metrics complete |
| `ebay_order_expenses` AD_FEE | 2025-09-30 | **2026-09-03** | 3 | **TY Ad-Generated = Pending** |

Each TY source ends on a different day. That is published in `meta.source_max_dates` and shown
in the dashboard note — it is not smoothed over. **Re-check these before every rebuild.**

### Why TY Ad-Generated is `Pending` and must stay so

AD_FEE billing reaches only 2026-09-03 — 3 of 29 TY days. Computing it anyway would publish a
figure a reader interprets as "almost no TY sales came from ads", which is false. `0` reads as
"no ad sales"; `null` reads as "not yet known", which is the truth. The dashboard reads the
available-through date from `meta.ad_fee_available_through` so the note cannot go stale.

---

## 7. Published figures (this build)

| | LY Sept 2025 | TY Sept 2026 (partial) |
|---|---|---|
| Sales | **3,182.15** | **2,535.34** |
| Orders (distinct) | **185** | **133** |
| Units | 259 | 209 |
| Order lines | 194 | 144 |
| eBay `quantity_sold` | 235 | 204 |
| Views | 8,487 | 6,404 |
| Ad-Generated | **2,952.12** | Pending |
| Non-Ad-Attributed | 230.03 | Pending |

Ad Impressions **1,594,442** · Clicks **2,094** · Spend **295.26**
Rows **186** (173 Lamp Shade · 13 Wall Plug) · GBP 157 / EUR 29 · Images 184/186
Segments: **A 38 · B 2 · C 3 · D 143** (= 186; D is 28 by the LY>0/TY=0 rule + 115 fallback)

### Control `164525233292`, dashboard vs raw

| Metric | Raw | Dashboard |
|---|---|---|
| LY Sales | 1,210.05 | **1,210.05** |
| LY Orders | 62 | **62** |
| LY order lines / units | 66 / 94 | 66 / 94 |
| TY Sales | 515.21 | 515.21 |
| TY Orders | 21 | 21 |
| LY / TY Views | 3,056 / 778 | 3,056 / 778 |
| LY / TY Conversion % | 2.72 / 5.14 | 2.72 / 5.14 |
| LY / TY Avg Price | 12.87 / 13.21 | 12.87 / 13.21 |
| Ad Impressions / Clicks / Spend | 90,146 / 290 / 53.53 | 90,146 / 290 / 53.53 |
| LY Ad-Generated / Non-Ad | 1,210.05 / 0.00 | 1,210.05 / 0.00 |
| TY Ad-Generated | — | **Pending** |

---

## 8. Scope — locked

**Population = utharsika's PH product assignment, NOT "products that sold".**

```
staff.users (utharsika = id 109)
  -> staff.ph_categories (user_id = 109)      -> id 66 'Lampshade', id 67 'Wall plug'
  -> staff.ph_category_products (source_id=2)  -> ref_id = eBay item_id
```

`source_id` is polymorphic: **1 = Amazon ASIN, 2 = eBay item_id, 16 = B&Q EAN**. Use 2.
The join column is **`ph_category_id`**, not `category_id`.

**186 eBay IDs → 186 rows.** Re-verified 2026-09-30: 186 assigned ids, MD5
`4e23f0b308d204b65a21d37a269229a7`, 173 Lamp Shade / 13 Wall Plug — identical to the
2026-09-29 capture, so scope has not drifted.

Assigned products with **zero** September sales stay visible at 0.00. A zero-sales row is
legitimate **only** because the product is assigned — never because it merely exists on eBay.
No Bulbs, Transformers or Drivers are reachable: those two category ids are the only entry point.

### The six approved accounts (nothing else)

| Dashboard account | `sub_source` | Extra filter | Rows |
|---|---|---|---|
| Sunsone | 4 | — | 44 |
| Ledsone | 1 | listing site = UK | 92 |
| Electricalsone | 22 | — | 21 |
| Huttenlampen | 28 | — | 9 |
| ledsone uk de | 1 | listing site = Germany | 14 |
| ledsone de | 27 | — | 6 |

`ledsone uk de` is a **reporting group, not a database account** — the estate holds only two
LEDSone sub_sources (1 and 27). `listings.ebay_listings.site` is spelled `'UK'`/`'Germany'`,
**not** `'GB'`/`'DE'`; `traffic_data.site_code` is `'EBAY-GB'`/`'EBAY-DE'`;
`campaigns.marketplace_id` is `'EBAY_GB'`/`'EBAY_DE'`; `market_place.abbreviation` is `'UK'`.
Four spellings of the same idea — map them.

---

## 9. Two concepts people keep confusing

- **Promoted Standard (`AD_FEE`)** — charged only when an ad causes a sale, carries a real
  `order_id` + `item_id` → **proves attribution at purchased-SKU level**.
- **Promoted Advanced (`PREMIUM_AD_FEES`)** — charged per click, `order_id = '0'` → **cannot be
  tied to a purchase**, so Advanced-driven revenue necessarily sits in Non-Ad-Attributed.

**Ad-Generated ≠ Attributed.** `sale_amount_listing_currency` is credited to the *clicked*
listing and can legitimately exceed that listing's own sales. It is **never** subtracted from
Total Sales.

---

## 10. Gates that enforce this contract

`npm run validate` — all must pass. The ones specific to this contract:

| Gate | Asserts |
|---|---|
| 17 | date scope: September 2025 / 2026 only, 0 rows outside |
| 18 | per-currency rows and Sales reconcile against an **independently derived** aggregation |
| 28 / 38 | per-account and per-category rows and Sales reconcile |
| 34–37 | every eBay ID is in the PH assignment; only Lamp Shade / Wall Plug; no bulbs/transformers/drivers |
| 40 | Orders equals the **raw extract**, re-read directly — not just build output |
| 40b | `Orders ≤ OMS units` (same source, same window) |
| 40c | control `164525233292`: LY Orders 62, LY Sales 1,210.05, lines 66, units 94 |
| 40d | Orders differs from `quantity_sold` **and** from units — not a relabelled units column |
| 40e | `Orders ≤ order lines`, and multi-line orders demonstrably collapse |
| 41 | Conversion = `quantity_sold / views`, **not** distinct Orders / views |
| 41b | **LY regression guard** — LY is closed data; Sales/Orders/Views/Units/Ad-Generated are absolutes |
| 41c | **every published field on every row equals the raw extract** (186 × 16 = 2,976 checks) |
| 42 | Avg Price = Sales / units, never over Orders |
| 44 | ROAS = aggregate Ad Sales / Ad Spend |
| 45 / 46 | LY Sales = Ad-Generated + Non-Ad on every row; control splits exactly |
| 47 | TY attribution is `null` (Pending), never 0 |

`build/build.mjs` additionally **throws** before writing if any row has
`orders > units`, `orders > lines`, or `ly_ad_generated > ly_sales`, or if any extract row is not
33 columns wide.

**If a gate fails, fix the data or the gate's premise — never loosen a gate to make it pass.**
Two precedents: a currency gate caught real live-data drift (fixed by snapshotting dataset and
baseline together, not by widening tolerance); and an `Orders ≤ quantity_sold` gate failed
correctly because the premise was false — the premise was removed, not the tolerance.

---

## 11. Raw reconciliation standard

Every correction must be proven against raw records, not against the dashboard.

**This build:** 20 eBay IDs × 26 metrics = **520 checks, 0 failures**, plus 42 supporting-field
checks and 3 Segment-B window checks — **565 raw checks, 0 failures**. All six accounts, both
categories, all five segment values, and rows with: sales, zero sales, multiple quantities per
order, multi-line orders, ads, and no ads.

Full matrix: `validation/raw-reconciliation-2026-09-30.csv`
(Account · eBay ID · Metric · Raw LEDsone Value · Dashboard Value · Difference · Result)

When in doubt: **go to the raw source, reconcile ≥15 IDs across all six accounts, and publish
`Pending` rather than a number you cannot prove.**
