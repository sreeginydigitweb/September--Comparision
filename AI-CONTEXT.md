# AI-CONTEXT.md — September Comparison Dashboard

Hand this file to any AI coding tool. It is the complete working context: what the project
is, the rules that must not be broken, where every number comes from, and what is left to do.

Last updated: 2026-09-30 (FINAL RAW DATA AUDIT). Status: **fully re-extracted from raw,
validated, and published to PH row 1947.** Every metric now comes from ONE query
(`sql/i-fresh-authoritative.sql`) — there are no side-car evidence files left to drift.

---

## 1. What this project is

A single-page dashboard comparing eBay product performance **LY September 2025 vs TY
September 2026** for PH (Product Handler) user **utharsika**, reviewed by a senior manager.

Deliverables:
- `index.html` — the dashboard (reads `data/september-comparison.json` over HTTP)
- `September-Comparison-Dashboard.html` — self-contained standalone with data embedded
- The standalone is published into a database row that the business reads (see §8)

Zero dependencies, zero build step, no framework. Plain Node ESM + vanilla JS.
The only npm package used is `pg`, borrowed from `../Task 4/node_modules/pg`.

---

## 2. HARD RULES — do not break these

| Rule | Why |
|---|---|
| **`ledsone` DB is SELECT / READ ONLY** | Production. Connector user is `dbhub_readonly`, so writes fail anyway — do not try to work around it. |
| **PH DB: max ONE UPDATE to row 1947. NO INSERT.** | Business row. Never create a second row; never touch another row. |
| **No Git commit. No Git push.** | The user controls version history. Leave `HEAD` alone. |
| **Never fabricate a number** | If a source is incomplete, publish `Pending`/`N/A` and record the available-through date. This has been enforced repeatedly — see §6. |
| **Credentials never stored in the repo** | `PH_DB_URL` is supplied at runtime only. |
| **Do not touch the PH Priors MariaDB "Too many connections" issue** | Separate infrastructure problem, explicitly out of scope. |
| **Preserve identity fields** | `assigned_user = utharsika`, `assigned_user_team = ph_priors`, `task_id = september-comparison-V001-utharsika` |

---

## 3. Scope — locked, do not "improve" it

**Population = utharsika's PH product assignment. NOT "products that sold".**

```
staff.users (utharsika = id 109)
  -> staff.ph_categories (user_id = 109)      -> id 66 'Lampshade', id 67 'Wall plug'
  -> staff.ph_category_products (source_id=2)  -> ref_id = eBay item_id
```

- `source_id` is polymorphic: **1 = Amazon ASIN, 2 = eBay item_id, 16 = B&Q EAN**. Use 2.
- The join column is **`ph_category_id`**, NOT `category_id`. (Easy mistake.)
- An item assigned to *both* categories resolves to **Wall Plug**.
- Category labels are normalised for display: `Lampshade` → **Lamp Shade**, `Wall plug` → **Wall Plug**.

**Result: exactly 186 eBay IDs → 186 rows.** Each item belongs to exactly one account+marketplace.

**Assigned products with ZERO September sales MUST stay visible** (showing 0.00). This is a
deliberate business decision ("Option 2"). A zero-sales row is legitimate *only* because the
product is assigned — never because it merely exists on eBay.

### The six approved accounts (nothing else)

| Dashboard account | `sub_source` | Extra filter | Rows |
|---|---|---|---|
| Sunsone | 4 (`so_926407`) | — | 44 |
| Ledsone | 1 (`led_sone`) | listing site = UK | 92 |
| Electricalsone | 22 | — | 21 |
| Huttenlampen | 28 (`huettenlampen`) | — | 9 |
| ledsone uk de | 1 (`led_sone`) | listing site = Germany | 14 |
| ledsone de | 27 (`ledsonede`) | — | 6 |

`ledsone uk de` is a **reporting group, not a database account** — the estate holds only two
LEDSone sub_sources (1 and 27). Do not go looking for a third; it does not exist.

**Row grain: `account + eBay item_id + marketplace`.** Never blend accounts.

### Currency filter
Labelled by selling region as well as currency — **`GBP — UK`** and **`EUR — DE`** (cards show
`GBP (UK)`) — because the business reads these as countries, not currency codes. The mapping
is derived from `row.marketplace` at runtime (`GB`→`UK`), so it can never drift from the data.
The option **value** stays the bare currency code, so filter logic is untouched.
GBP = 157 rows (Sunsone, Ledsone, Electricalsone) · EUR = 29 rows (Huttenlampen, ledsone de,
ledsone uk de). **Currencies are never summed together.**

### Category dropdown
Must **always** offer `All categories / Lamp Shade / Wall Plug` for **every** account, even
when an account has no rows in one category. It is a static business filter, not derived
from the data. Empty result → show an empty state and disable Download.

---

## 4. Data sources and the exact metric contract

Full detail: **`validation/metric-contract.md`** (authoritative — read it before changing any field).

| Field | Source | Formula / rule |
|---|---|---|
| LY / TY Sales | `order_management.orders` × `order_item_info` | `SUM(item_quantity × item_price)`, `status NOT IN ('Cancelled','Refunded')`, `order_id` non-blank — the SAME valid-order population as Orders |
| LY / TY Orders | `order_management.orders` × `order_item_info` | `COUNT(DISTINCT order_id)` at account+item+marketplace, `status NOT IN ('Cancelled','Refunded')`, `order_id` non-blank = **actual distinct customer orders**. **NOT** `quantity_sold`, **NOT** OMS `item_quantity`. Query `sql/h-actual-orders.sql` (corrected 2026-09-30) |
| Views | `ebay_traffic_data.ebay_views` | `external_views` deliberately excluded |
| Conversion % | derived | `quantity_sold / ebay_views × 100` — algebraically equals eBay's own `str`. **Still units-based on purpose** — never recompute it from distinct Orders. `ly_qty_sold`/`ty_qty_sold` carry the numerator |
| Avg Price | derived | `Sales ÷ units sold`. **Fallback (ASP)** — no historical listing price exists anywhere |
| LY Ad-Generated Sales | `accounting.ebay_order_expenses` | `fee_type='AD_FEE'`, `order_id<>'0'`, DISTINCT `(order_id,item_id)` → the matched **order line's revenue**, never the fee amount. **NO fee-date window** — eBay bills on its own clock; filtering fees to September dropped an order billed 2025-08-31 and understated this by £14.29 |
| LY Non-Ad-Attributed | derived | `LY Sales − LY Ad-Generated` |
| TY Ad-Generated | — | **`null` → renders "Pending"**. See §6 |
| Ad Impressions / Clicks / Spend | `ebay_campaigns.listing_performance` | `impressions`, `clicks`, `ad_fees_listing_currency` |
| eBay Attributed Ad Sales | `listing_performance.sale_amount_listing_currency` | Click-attributed to the *clicked* listing. **Never subtract from Total Sales** |
| ROAS / ACoS | derived | `SUM(ad_sales)/SUM(ad_spend)` — **never an average of row-level rates** |
| SKU Image | `listings.ebay_listings.main_image_url` | http→https. 4 legitimate CDNs, not just `i.ebayimg.com` |
| Segment | derived | Strict precedence **D → C → B → A**, **D is the fallback** — every assigned product is classified and shown |

### Two concepts people constantly confuse
- **Promoted Standard (`AD_FEE`)** — charged only when an ad causes a sale, carries a real
  `order_id` + `item_id` → **proves attribution at purchased-SKU level**.
- **Promoted Advanced (`PREMIUM_AD_FEES`)** — charged per click, `order_id = '0'` → **cannot
  be tied to a purchase**, so Advanced-driven revenue necessarily sits in Non-Ad-Attributed.

**Ad-Generated ≠ Attributed.** `sale_amount_listing_currency` is credited to the clicked
listing and can legitimately exceed that listing's own sales (16 of 186 rows do).

---

## 5. Which database — this matters

Two connectors reach *different* databases. Using the wrong one silently publishes stale data.

| Connector | Database | Use |
|---|---|---|
| **Ledsone postgres** | `ledsone` @ `169.58.91.229:5432`, user `dbhub_readonly` | **The source of truth.** READ ONLY |
| **postgres (2)** | `order_management_copy` @ `10.8.0.3:5435`, user `postgres` | A **stale mirror** + holds the publish target `tech_team_outputs.ph_task` |
| postgres *(no suffix)* | — | Not a database at all — a file/knowledge-base connector. Ignore |

**Freshness verified 2026-09-29 — the mirror lags badly:**

| Source | Mirror | Fresh `ledsone` |
|---|---|---|
| orders | 2026-09-23 | **2026-09-29** |
| traffic | 2026-09-22 | **2026-09-27** |
| listing_performance | 2026-09-16 | **2026-09-29** |
| AD_FEE | 2026-09-02 | **2026-09-03** |

**Always re-run a `MAX(date)` freshness check before extracting. Never overwrite fresher
data with an older source.**

---

## 6. Why TY Ad-Generated is "Pending" (do not "fix" this)

eBay `AD_FEE` billing reaches only **2026-09-03** — 3 of 29 TY days, covering
**£320.45 of £2,507.56 = 12.8%** of TY sales by value.

Computing it anyway would publish **£77.04**, which a reader interprets as "only 3% of TY
sales came from ads" — false. A `0` reads as "no ad sales". `null` reads as "not yet known",
which is the truth. The dashboard reads its available-through date from
`meta.ad_fee_available_through` so the note cannot go stale.

Re-check the date each run. If AD_FEE ever gains real September coverage, compute
`TY Ad-Generated` with the same `(order_id, item_id)` method and
`TY Non-Ad = TY Sales − TY Ad-Generated`.

---

## 7. Pipeline — how to rebuild

```bash
# 1. Extract (fresh ledsone, SELECT only) — sql/g-fresh-ledsone-utharsika.sql
#    Returns ONE row, ONE column `payload` = JSON array of 28-element arrays.
#    Save the raw MCP response envelope to:
#       evidence/extract-2026-09-29-fresh/pack-g-fresh-extract.json
#    build.mjs reads wrapper.data.rows[0].payload

# 2. Build the dataset
node build/build.mjs evidence/extract-2026-09-29-fresh/pack-g-fresh-extract.json

# 3. Validate — 52 gates + coverage check, all must pass
npm run validate

# 4. Package the standalone
npm run standalone

# 5. Serve locally to eyeball it
npm start          # http://localhost:3000  (NOT 8080)

# 6. Publish (see §8)
npm run push-ph -- --dry-run
npm run push-ph
```

### The 28-column extract contract
`build/build.mjs` destructures positionally — column order is load-bearing:

```
0  acct_id      7  parent_sku   14 ty_views    21 prev7
1  account      8  title        15 ly_ad_sales 22 sku_id
2  item_id      9  ly_sales     16 ty_ad_sales 23 category
3  marketplace  10 ty_sales     17 ty_spend    24 category_id (always '')
4  currency     11 ly_units     18 ty_impr     25 ly_orders
5  sku_count    12 ty_units     19 ty_clicks   26 ty_orders
6  one_sku      13 ly_views     20 last7       27 image_url
```

Supporting evidence files `build.mjs` / `validate.mjs` read:
- `evidence/extract-2026-09-29-fresh/actual-orders.json` — **LY/TY Orders**, distinct order
  counts from `sql/h-actual-orders.sql`. Extract cols 25/26 are `quantity_sold` and now feed
  **Conversion only**. Gate 40 re-reads this file directly.
- `evidence/extract-2026-09-29-fresh/ly-sku-ad-split.json` — LY ad split, 42 selling items
- `evidence/extract-2026-09-29-fresh/sales-reconciliation.json` — independent baseline (gate 18)
- `evidence/extract-2026-09-29-fresh/utharsika-ebay-allowlist.json` — the 186 assigned IDs

### Guards that will stop a bad build
- `build.mjs` throws if any row is outside the 2 categories / 6 accounts.
- `build.mjs` throws if the LY split disagrees with LY sales for any item (±0.01).
- `standalone.mjs` re-checks scope before packaging.
- `push-ph-task.mjs` checks 9 content markers + exactly 6 embedded accounts, and verifies
  MD5 inside the transaction before COMMIT.

**If a gate fails, fix the data or the gate's premise — never loosen a gate to make it pass.**
(Precedent: a currency gate caught real live-data drift; the fix was capturing dataset and
baseline in one snapshot, not widening the tolerance.)

---

## 8. Publishing to PH Priors — the outstanding step

Target: `order_management_copy` → `tech_team_outputs.ph_task`, **`id = 1947`**.
Update **only** `html_content` and `updated_at`.

```bash
PH_DB_URL='postgresql://USER:PASS@149.28.134.54:5435/order_management_copy' npm run push-ph -- --dry-run
PH_DB_URL='postgresql://USER:PASS@149.28.134.54:5435/order_management_copy' npm run push-ph
```

`build/push-ph-task.mjs` is transactional and parameterized: `SELECT … FOR UPDATE`, guards on
`id = 1947 AND assigned_user = 'utharsika' AND assigned_user_team = 'ph_priors'`, verifies the
stored MD5 against the source file, and aborts otherwise.

**Credentials are deliberately not in this repo** and are not present anywhere on the current
machine (checked: environment, `pgpass.conf`, shell history, local settings, sibling `.env`
files). The user must supply `PH_DB_URL` at run time.

> **Do NOT publish through the MCP connector instead.** It would mean reproducing ~184 KB of
> HTML character-exact inside SQL statement text; staging it in chunks would require many
> UPDATEs to row 1947, breaking the one-UPDATE rule. The parameterized script is the only
> sound route.

**Current state:** built, validated, NOT yet published.
`September-Comparison-Dashboard.html` — 186 rows, **184,491 chars**, md5
**`ec3dfd6fa4b97cb24d64cc16d4762ee7`**.

Post-publish, verify: stored length = source length · stored hash = source hash ·
`assigned_user = utharsika` · `assigned_user_team = ph_priors` · exactly 1 row for the project.

---

## 9. Current verified numbers (fresh LEDsone, 2026-09-29)

| | |
|---|---|
| Rows | 186 (173 Lamp Shade · 13 Wall Plug) |
| Extract | `sql/i-fresh-authoritative.sql`, one query, 33 columns, no side-cars |
| LY Sales | 3,182.15 = Ad-Generated 2,952.12 + Non-Ad 230.03 |
| TY Sales | **2,535.34** (partial — orders through 2026-09-29) |
| LY / TY Orders | **185 / 133** distinct customer orders. For contrast: eBay `quantity_sold` 235 / 204, OMS units 259 / 209, order lines 194 / 144 |
| Ad Impressions / Clicks / Spend | **1,594,442 / 2,094 / 295.26** |
| Segments | **A 38 · B 2 · C 3 · D 143** = 186. D is the CATCH-ALL: 28 by the LY>0/TY=0 rule + 115 fallback. No row is ever unclassified or hidden |
| Currencies | GBP 157 rows · EUR 29 rows (**never summed together**) |
| Images | 184 / 186 |

**Control SKU `164525233292`** (the one the business checks):
LY Sales 1,210.05 · TY Sales 515.21 · LY Views 3,056 · TY Views 766 · LY Orders **62** ·
TY Orders **21** · LY Conv 2.72% · TY Conv 5.22% · LY Price 12.87 · TY Price 13.21 ·
LY Ad-Generated 1,210.05 · LY Non-Ad 0.00 · TY Ad-Generated **Pending** ·
Impressions 89,138 · Clicks 282 · Spend 52.02 · ROAS 3.32

Reconciliation standard met: **12 IDs × 18 fields = 216 raw-vs-dashboard checks, 0 failures,
all 6 accounts covered.**

---

## 10. Environment gotchas that cost real time

- **`listings.ebay_listings.site` is spelled `'UK'` / `'Germany'`** — NOT `'GB'` / `'DE'`.
  Map it. Meanwhile `traffic_data.site_code` is `'EBAY-GB'`/`'EBAY-DE'` and
  `campaigns.marketplace_id` is `'EBAY_GB'`/`'EBAY_DE'`, and `market_place.abbreviation`
  uses `'UK'`. Four different spellings of the same idea.
- **`staff.ph_category_products` joins on `ph_category_id`**, not `category_id`.
- **Bash heredocs fail in this environment** on content with backticks/quotes. Write files
  with the Write tool instead. Python is not installed; use Node for scripted edits.
- **Large MCP SQL results are auto-saved to a file** instead of returning inline. This is a
  feature — process the file with Node rather than pulling 58 KB through context.
- **`COUNT(DISTINCT …) OVER ()` is unsupported** — split into separate CTEs.
- **Browser QA:** patchright runs `page.evaluate` in an **isolated world**, so page globals
  are invisible. Reach them by injecting a `<script>` that writes JSON into a hidden DOM
  node, then read that node. `window.__dashboard` is the exposed hook.
- **Collapsed `<details>` elements** return empty `innerText` — read `innerHTML` instead.
- **`net::ERR_BLOCKED_BY_ORB` on `cdn.listingmirror.com`** in headless QA is expected;
  thumbnails need internet and are not a bug.
- The local server is on **port 3000** (`build/server.mjs`), auto-incrementing if busy.

---

## 11. Repo map

```
index.html                         the dashboard UI
data/september-comparison.json     built dataset (meta + 186 rows)
September-Comparison-Dashboard.html standalone, data embedded
build/build.mjs                    extract -> dataset (+ scope & split guards)
build/validate.mjs                 52 gates + coverage check
build/standalone.mjs               packager
build/server.mjs                   static server, port 3000
build/push-ph-task.mjs             transactional PH publish
sql/i-fresh-authoritative.sql      CURRENT extract — ONE query, 33 cols, ALL metrics
sql/g-fresh-ledsone-utharsika.sql  superseded (28 cols, Orders = quantity_sold)
sql/h-actual-orders.sql            superseded (Orders side-car, folded into pack I)
sql/f-combined-sales-driven.sql    superseded (22 cols, sales-driven population)
evidence/extract-2026-09-30-final/ CURRENT evidence set
evidence/extract-2026-09-29-fresh/ superseded
evidence/extract-2026-09-29/       superseded (from the stale mirror)
validation/metric-contract.md      AUTHORITATIVE field-by-field contract
handover/current-state.md          running state log
```

---

## 12. History — corrections already made, do not regress them

Each of these was a senior complaint that took a full cycle to fix:

1. **Population was a FULL OUTER merge** → any ID in listings/traffic/ads appeared
   (17,845 → 3,134 rows). Fixed to sales-driven, then to the PH assignment (186).
2. **All accounts appeared** → restricted to the six approved groups.
3. **No product scope** until the PH assignment was discovered. A keyword-derived
   allowlist was refused as fabrication.
4. **Order status never filtered** → Cancelled (£397.52) and Refunded (£5,404.54) were
   being counted as revenue.
5. **Orders used OMS units**, then eBay `quantity_sold` — both are UNITS. Corrected
   2026-09-30 to `COUNT(DISTINCT order_id)`, actual distinct customer orders (control
   164525233292 LY: 94 OMS units → 83 quantity_sold → **62 real orders**). Conversion %
   deliberately stayed on `quantity_sold` so it remains eBay's own STR.
6. **Ad Sales conflated** click-attribution with actual SKU revenue.
7. **TY ad values were nearly estimated** → refused; `Pending` instead.
8. Refused throughout: a third LEDSone account, invented Wall Plug rows for
   Huttenlampen/ledsone de, and any estimated TY figure.

When in doubt: **go to the raw source, reconcile ≥10 IDs across all six accounts, and
publish `Pending` rather than a number you cannot prove.**
