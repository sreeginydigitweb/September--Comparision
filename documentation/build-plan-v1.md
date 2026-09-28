# Build Plan — V1

Created 2026-09-28. Executable without further business clarification.
All definitions are locked in `analysis-v1-decisions.md`.

---

## Architecture — LOCKED

**Single standalone `index.html` with the dataset embedded as JSON. No backend, no
framework, no dependencies, no build tool, no deployment.**

Chosen over the `ppc-dashboard` pattern (Laravel + live DB, an operational tool — far
more than a point-in-time comparison needs) and over an api-backed `Task 4` pattern.
Matches the `Listing Title` precedent, which the `static-html-generate` skill already
supports.

**Embedded, not `fetch`ed** — a `file://` page cannot fetch a sibling JSON file (CORS).
Embedding keeps it double-clickable with zero setup, which is the fastest safe path.

Expected size: ~5,000–10,000 rows of ~25 fields — well within a comfortable single file.

> **AS BUILT (2026-09-28) — deviation, deliberate.** The real dataset came out at **17,845
> rows / 8.6 MB**, well above the estimate, and the brief required a localhost URL rather
> than `file://`. So `index.html` **fetches** `data/september-comparison.json` over
> localhost instead of embedding it, and `build/render.mjs` + `build/template.html` were
> **not created** — the page is a single authored file served by `build/server.mjs`.
> Embedding 8.6 MB into the HTML would have made the page slow to parse for no benefit
> once a server was required anyway.

---

## Data extraction plan

Five read-only query packs. **Each aggregates to its own grain BEFORE any join** — this
is the single control that prevents row multiplication, SKU fan-out, account cross-joins
and duplicated ad spend.

Common keys: `sub_source_id` (Account), `item_id` (eBay ID), `marketplace`.

### A — Identity (`sql/a-identity.sql`)
`listings.ebay_listings` filtered `all_list = 1`.
Per `item_id`: `sub_source`, `COUNT(DISTINCT sku)`, single SKU or `parent_sku`, `title`,
`site`, `status`, `is_ended`.
→ one row per `item_id + sub_source`.

### B — Sales & units (`sql/b-sales.sql`)
`orders` × `order_item_info` × `sub_source` × `source`, `source_name = 'EBAY'`.
`SUM(CAST(item_quantity AS INT) * CAST(item_price AS DECIMAL(10,2)))` and
`SUM(CAST(item_quantity AS INT))`, split `period IN ('LY','TY')`.
**Guard:** `source_id = 2` filter is mandatory — `item_id` also holds Shopify product ids.
→ one row per `item_id + sub_source + period`.

### B2 — TY daily sales for Segment B (`sql/b2-ty-daily.sql`)
Same joins, `GROUP BY item_id, sub_source, order_date`, TY window only.
→ feeds the 7-day-vs-7-day recovery test.

### C — Traffic (`sql/c-traffic.sql`)
`business_reports.ebay_traffic_data`. `SUM(ebay_views)` by
`item_id + sub_source + site_code + period`. Verified one row per
item/account/site/day — no dedup needed.
→ one row per `item_id + sub_source + marketplace + period`.

### D — Ad performance (`sql/d-ads.sql`)
`listing_performance` JOIN `campaigns` on `campaign_id` (needed for `marketplace_id` and
`sub_source`). `SUM(sale_amount_listing_currency)`, `SUM(ad_fees_listing_currency)`,
`SUM(impressions)`, `SUM(clicks)` by `ebay_listing_id + campaigns.sub_source +
marketplace_id + period`.
**Guards:** aggregate before joining or the campaign fan-out multiplies spend; never touch
`attributed_sales`/`sold` as money; never union `campaign_performance`.
→ one row per `item_id + sub_source + marketplace + period`.

### E — Approved ad cost, reference only (`sql/e-billed-adcost-reference.sql`)
`accounting.ebay_order_expenses`, `fee_type IN ('AD_FEE','PREMIUM_AD_FEES')`, by
`item_id + sub_source + period`. **Not joined into the dashboard** (§9 of the analysis —
only 3 TY days exist). Run once and store in `evidence/` as the record of why.
`fee` needs no dedup; `transaction_amount` would.

### F — Final join (in the build script, not SQL)
`FULL OUTER` merge of A, B, C, D on `item_id + sub_source + marketplace`, so a listing
with ads but no sales, or views but no ads, still appears. Then derive YoY %, Conversion,
ASP, ROAS, ACoS, Segment.

---

## Final dataset contract

One object per row, written to `data/september-comparison.json`:

```
account, account_id, marketplace, currency,
ebay_id, sku, sku_count, title,
ly_sales, ty_sales, yoy_pct,
ly_ad_sales, ty_ad_sales,
ly_views, ty_views,
ly_orders, ty_orders,
ly_conversion_pct, ty_conversion_pct,
ly_price, ty_price,
ad_impressions, ad_clicks, ad_spend, ad_sales,
roas, acos, segment
```

Plus a `meta` object: `generated_at`, `ly_window`, `ty_window`, per-source `max_date`,
`ty_is_partial: true`, `row_count`, and per-currency totals.

Numerics are numbers or `null`. `null` renders as `N/A`; `yoy_pct` may be the string
`"NEW"`. No blended cross-currency total anywhere.

---

## Ordered implementation steps

1. Write the five SQL packs in `sql/`. Review each for grain before running.
2. Run A–E read-only through the Ledsone MCP (`postgres-mcp-fetch`). Save raw results to
   `evidence/extract-2026-09-28/*.json`.
3. Record row counts and per-source max dates in `evidence/extract-2026-09-28/counts.md`.
4. Write `build/build.mjs` (plain Node, zero dependencies): load the five JSON files,
   merge per §F, derive the computed fields, apply the D→C→B→A→Other precedence, emit
   `data/september-comparison.json`.
5. Run `build/validate.mjs` — the gates below. Stop on any failure.
6. Write `build/render.mjs`: inject the JSON into `build/template.html` → `index.html`.
7. Open `index.html`, confirm it loads with no console error, filters and sorting work,
   and the partial-TY banner is visible.
8. Record the run in `validation/stage-3-build.md`.

---

## Dashboard implementation

Single `index.html`, no external requests, no CDN, no fonts.

- **Header** — title, LY/TY windows, and a **persistent amber banner**:
  *"TY September 2026 is PARTIAL — sales & ads to 28 Sep, traffic to 26 Sep. YoY is
  understated."*
- **KPI strip** — per currency, never blended: LY vs TY Sales, Views, Orders, Ad Spend,
  Ad Sales, and segment counts A/B/C/D/Other.
- **Controls** — Account dropdown, Segment dropdown, free-text search (eBay ID / SKU /
  title), **Clear filters**, and a live **"showing X of Y rows"** count.
- **Table** — the 21 columns in the specified order, click-to-sort on every column
  (numeric-aware, `N/A`/`NEW` last), sticky header, compact rows. Segment rendered as a
  coloured chip. Negative YoY in red.
- **Footnotes** — ASP definition; Ad Spend source and why; ~25% Advanced
  under-attribution; V1 segment precedence; stages 7 and 8 absent.

Plain JS, no framework. Client-side filter/sort over the embedded array.

---

## Validation gates (`build/validate.mjs`)

1. **No row multiplication** — `item_id + sub_source + marketplace` is unique. Fail on any
   duplicate.
2. **Sales reconcile** — summed `ly_sales`/`ty_sales` per currency equal a direct
   `GROUP BY` total from pack B, to the penny.
3. **Ad spend not double-counted** — dashboard Ad Spend equals pack D's total exactly, and
   pack E contributes nothing.
4. **No cross-currency sum** — every KPI carries a currency; no field aggregates rows of
   differing currency.
5. **Segment exclusivity** — every row has exactly one segment; counts sum to the row
   count; a hand-checked sample of each of D/C/B/A matches the precedence.
6. **Segment D strictness** — every D row has `ty_sales = 0` and `ly_sales > 0`.
7. **Divide-by-zero** — no `Infinity`, no `NaN`, no `null` arithmetic anywhere in the JSON.
8. **Partial-TY metadata present** — `ty_is_partial` true and per-source max dates match
   what the extract observed.
9. **Coverage** — LY and TY each return rows; neither silently empty.
10. **Page loads** — `index.html` opens with no console error and the row count is > 0.

---

## Files to create

| Path | Purpose |
|---|---|
| `sql/a-identity.sql` | Pack A |
| `sql/b-sales.sql` | Pack B |
| `sql/b2-ty-daily.sql` | Pack B2 — Segment B recovery |
| `sql/c-traffic.sql` | Pack C |
| `sql/d-ads.sql` | Pack D |
| `sql/e-billed-adcost-reference.sql` | Pack E — reference only |
| `query-packs/september-v1-pack.md` | Run order, grain, guards |
| `evidence/extract-2026-09-28/*.json` | Raw results |
| `evidence/extract-2026-09-28/counts.md` | Row counts, max dates |
| `build/build.mjs` | Merge + derive |
| `build/validate.mjs` | The 10 gates |
| `build/render.mjs` | Inject JSON into the template |
| `build/template.html` | Page markup, CSS, JS |
| `data/september-comparison.json` | Final dataset |
| `index.html` | **The deliverable** |
| `validation/stage-3-build.md` | Run record |

**Modified:** `handover/current-state.md` (stage → Build complete).
`documentation/analysis-v1-decisions.md` only if a decision proves wrong in build.

> `build/` and `data/` are new top-level directories, outside the 12-folder standard,
> matching the sibling pattern where a project's own artefacts sit at root
> (`Listing Title/listing-title/`, `Task 4/api/`).

---

## Minimum path if time runs short

Steps 1–6 are the irreducible core. If pressed:

- **Drop first:** pack B2 and Segment B. Every B row falls to Other; A, C, D still work,
  and the dashboard is complete and honest. Saves the most work for the least loss.
- **Drop second:** the KPI strip. The table alone satisfies the brief.
- **Never drop:** the partial-TY banner, validation gates 1–3, or the currency separation.
  Those three are what keep the numbers defensible.
