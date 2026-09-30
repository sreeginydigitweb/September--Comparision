# Validation — Six Account Scope Fix (2026-09-29)

Account scope narrowed to the six business reporting groups the senior reviews. The
dataset itself is filtered — this is not a dropdown change.

## Account mapping

| Business group | DB source | Rows | LY Sales | TY Sales | Marketplaces |
|---|---|---|---|---|---|
| Ledsone | `led_sone` (1), marketplace ≠ DE | 876 | 43,841.17 | 34,654.80 | FR, GB, IE, US |
| Electricalsone | `electricalsone` (22) | 550 | 25,734.29 | 18,262.04 | DE, FR, GB, US |
| Sunsone | `so_926407` (4) | 416 | 12,234.70 | 14,210.29 | DE, FR, GB, US |
| ledsone uk de | `led_sone` (1), marketplace = DE | 234 | 12,437.20 | 4,889.79 | DE |
| ledsone de | `ledsonede` (27) | 190 | 8,462.69 | 7,364.26 | DE, GB |
| Huttenlampen | `huettenlampen` (28) | 165 | 14,279.76 | 8,712.22 | DE |
| **Total** | | **2,431** | | | |

**`ledsone uk de` is a reporting group, not a database account.** `ebay_campaigns.seller_stores`
proves the estate holds only two LEDSone sub_sources — 1 (`LEDSone UK Limited`) and 27
(`LEDSONE UK LTD`) — so no third account exists. Per the business decision, the UK
account's DE-marketplace activity is reported separately from `Ledsone`. `DE` is the
verified `order_management.market_place.abbreviation` value.

**Before → after:** 3,134 rows across 14 accounts → **2,431 rows across exactly 6**.

## Test results

| # | Test | Result |
|---|---|---|
| 1 | Distinct account values = exactly the six | **PASS** — gates 22/23/24 |
| 2 | Dropdown = "All accounts" + six | **PASS** — 7 options, verified in browser |
| 3 | Unexpected account rows | **PASS** — 0 |
| 4 | Every `ledsone uk de` row is `led_sone` + DE | **PASS** — 234 rows, marketplaces `DE` (gate 25) |
| 5 | `Ledsone` excludes DE | **PASS** — 876 rows, marketplaces `FR,GB,IE,US` (gate 26) |
| 6 | `ledsone de` = sub_source 27, distinct | **PASS** — 190 rows (gate 27) |
| 7 | Per-account reconciliation vs direct DB aggregation | **PASS** — all six exact (gate 28) |
| 8 | Zero-sales rows | **PASS** — 0 (gates 15/16) |
| 9 | September 2025 / 2026 only | **PASS** — 2 year-months, 0 outside (gate 17) |
| 10 | No row multiplication | **PASS** — 2,431 keys / 2,431 rows (gate 2) |

`npm run validate` — **28/28 gates PASS.**

## Dashboard

Title **September Product Performance Comparison — LY vs TY**; subtitle **"Lamp Shade &
Wall Plug product sales for September 2025 vs September 2026."** Partial-TY notice
retained. 21 columns intact. Account dropdown shows friendly business names only — no
internal codes (`so_926407`, `led_sone`, `huettenlampen`, `ledsonede`).

Browser-tested on `file://` and localhost — 0 console errors, 0 failed requests, 0 external
references. Per-account counts driven through the real dropdown: Electricalsone 550 ·
Huttenlampen 165 · Ledsone 876 · Sunsone 416 · ledsone de 190 · ledsone uk de 234.
Download CSV: unfiltered 2,431 = population; filtered 71 = view. Segment, currency, search,
sort, reset and Show more all pass.

## PH Priors row 1947 — UPDATED

`html_content` 1,645,091 → **1,280,195** chars, md5 → **`2964711120f1b5d1bb969ca541e05035`**,
matching the source file exactly. Re-verified through a second connection (the MCP, as
`postgres`): subtitle, six-account statement and partial-TY notice all present, and a
search for every excluded account (`coventrylights`, `vintageinterior`, `dctransformer`,
`bestbringer`, `neighbourmarket`, `homin_gmbh`, `lighting_sone`, `re6865`) returns
**false** — none appears anywhere in the stored HTML.

Only `html_content` and `updated_at` changed. Unchanged: `id`, `project_name`,
`project_code`, `task_name`, `task_id`, `team`, `developer`, `assigned_user`,
`assigned_user_team`, `phase_level`, `version_level`, `version_status`, `action_took_by`,
`action_took_date_time`, `created_at`. Duplicate rows created: **0**.

## PENDING — product scope

**Lamp Shade / Wall Plug filtering is NOT applied.** No authoritative ID list exists:
`Ebay.xlsx` carries `xxxx` placeholders in all 18 ID cells, and the database has no usable
classification — `product_type` is 99.4% NULL, `parent_sku` is free text, and
`listing_attributes.Type` holds 1,881 uncontrolled values with **no "Wall Plug" value at
all**. The dashboard states this openly in its scope line.

To finish: supply the eBay item IDs for the intended Lamp Shade and Wall Plug products
with their owning account. `sql/f-combined-sales-driven.sql` takes an allowlist directly.
