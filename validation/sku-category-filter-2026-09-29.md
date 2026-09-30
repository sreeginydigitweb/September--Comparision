# Validation — SKU ID + Category filter (2026-09-29)

Adds **SKU ID** and **Category** columns and a **Category filter that cascades from
Account**, so a user can isolate a product group instead of seeing shades, bulbs and
transformers mixed together.

## Sources — item-level, single-valued

| Field | Source |
|---|---|
| **SKU ID** | `listings.ebay_listings.sku`, keyed `sub_source + item_id`, `all_list = 1` — **98.9%** coverage (2,404/2,431) |
| **Category** | `listings.ebay_listings.category_id` (item-level, **98.9%** coverage, 75 distinct), rendered as the leaf of the verified eBay category path taken from `product_type` — **95.8%** named (2,330/2,431) |

Unnamed category ids render as `Uncategorised (<id>)` and missing ones as `Unknown`, so
nothing is silently dropped or invented.

> **The SKU → Shopify/Amazon `product_type` route is deliberately NOT used.** It is
> many-to-many: 84% of items carried conflicting types (up to 28 on one item), and a
> flagged LED transformer carried `Lampshades & Lightshades`. `category_id` is the
> listing's own value — only **one** item in the population had more than one category.

## Categories separate the product groups

Gate 32 proves the groups are disjoint:

- **Shade** — `Lampshades & Lightshades`
- **Bulb** — `Light Bulbs`, `Light Bulbs & Lamps`
- **Transformer** — `Schaltnetzteile`, `Netzteilzubehör`, `Stromtransformatoren`, `Power Transformers`

Categories per account: Ledsone 52 · Electricalsone 36 · Sunsone 35 · ledsone uk de 23 ·
ledsone de 22 · Huttenlampen 20.

## Test results

| # | Test | Result |
|---|---|---|
| 1 | Account = Ledsone → only Ledsone rows | **PASS** — 876 rows, 0 other accounts |
| 2 | Category options cascade from Account | **PASS** — options are exactly Ledsone's 52 categories |
| 3 | Category = `Lampshades & Lightshades` isolates it | **PASS** — 83 rows, **0 bulb**, **0 transformer** |
| 4 | Bulb category shows no shades | **PASS** — `Light Bulbs` 118 rows, 0 shade rows |
| 5 | Account + Category + Segment stack | **PASS** — 30 rows, all three conditions hold |
| 6 | Download CSV respects all filters + sort | **PASS** — filtered 83 = view; unfiltered 2,431 = population; header carries `SKU ID` and `Category` |
| 7 | Reset restores all five controls | **PASS** — 2,431 rows, 76 category options (All + 75) |
| 8 | SKU ID visible and searchable | **PASS** |
| 9 | Category visible and searchable | **PASS** — search `Lampshades` → 294 rows, all matching |
| 10 | No row multiplication after enrichment | **PASS** — 2,431 keys / 2,431 rows |
| 11 | Unexpected accounts | **PASS** — 0 |
| 12 | Zero-sales rows | **PASS** — 0 |
| 13 | September 2025 / 2026 only | **PASS** |

Switching account refreshes the options and resets Category when the previous value is
unavailable — verified by switching Ledsone → Huttenlampen.

`npm run validate` — **33/33 gates PASS** (new: 29 SKU ID, 30 Category, 31 meta.categories,
32 group separation, 33 per-account category availability).

## Summary cards now follow the filters

Cards and per-currency totals recalculate from the filtered set, so
Ledsone + `Lampshades & Lightshades` reads **83 listings · A 43 · B 2 · C 3 · D 30 ·
Other 5** rather than the whole file. Currencies are still never blended.

## A real drift caught mid-run

Gates 18/28 failed on the first attempt: EUR TY was €9.16 above the reconciliation
baseline, traced to a live Huttenlampen order landing between the baseline capture and the
extract (TY September is open). Fixed properly — the dataset and its reconciliation
baseline are now produced by **one query in one snapshot**, so live orders cannot drift
between them. The gate was not loosened.

## Browser verification

`file://` and localhost, both on the same dataset: **0 console errors, 0 failed requests,
0 external references**. 23 columns — the required 21 plus SKU ID and Category.

## PH Priors row 1947 — UPDATED

`html_content` 1,280,195 → **1,486,619** chars, md5 → **`1e9ee9421541dd1992fa845ccb7eb6df`**,
matching the source file exactly. Re-verified through a second connection (the MCP, as
`postgres`): subtitle, Category filter, Category column, SKU ID column and partial-TY
notice all present; no unapproved account appears anywhere in the stored HTML.

Only `html_content` and `updated_at` changed. Unchanged: `id`, `project_name`,
`project_code`, `task_name`, `task_id`, `team`, `developer`, `assigned_user`,
`assigned_user_team`, `phase_level`, `version_level`, `version_status`, `action_took_by`,
`action_took_date_time`, `created_at`. Duplicate rows: **0**.

## Still open — the product decision itself

Category makes the product groups **selectable**; it does not decide which categories are
in scope. No category is pre-selected, and the dashboard says so. `product-scope-review.csv`
remains the route to a fixed Lamp Shade / Wall Plug population if the business wants the
report hard-limited rather than filterable.

Note "Wall Plug" still has no single verified category: the closest verified values —
`Electrical Sockets`, `Steckdosen- & Schalterteile`, `Power Strips & Surge Protectors` —
are kept separate rather than merged.
