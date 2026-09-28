# Source Data Map — September LY vs TY

Initial mapping. Created 2026-09-28 from **verified Discovery findings only**.

Database: **`ledsone`** (PostgreSQL 18.4, VPS instance, via the Ledsone MCP as
`dbhub_readonly`) — **READ / SELECT ONLY**.

`order_management_copy` and `analytics.ph_segment` are **OUT OF SCOPE** and appear
nowhere in this map.

## Status key

| Status | Meaning |
|---|---|
| **VERIFIED** | Table and column confirmed to exist, and September LY + TY data confirmed present |
| **PARTIAL** | A source exists but does not fully satisfy the field, or carries a known limitation |
| **PENDING ANALYSIS** | A business definition must be decided before this field can be produced |

---

## Candidate source tables (all VERIFIED to exist)

| Table | Grain | Role in this project |
|---|---|---|
| `order_management.orders` | one row per order | Sales, Orders, date filter, account filter |
| `order_management.order_item_info` | one row per order line | Sales, Orders, SKU, eBay item_id |
| `order_management.source` | lookup | Restricts to `source_name = 'EBAY'` |
| `order_management.sub_source` | lookup | **Account filter** |
| `business_reports.ebay_traffic_data` | item_id x day x account x site | Views, Impressions |
| `ebay_campaigns.listing_performance` | listing x ad group x campaign x day | Ad Sales, Ad Impressions, Ad Clicks, ROAS |
| `ebay_campaigns.campaigns` | one row per campaign | `marketplace_id` and `cost_type`, required before totalling ad money |
| `listings.ebay_listings` | one row per listing/SKU | SKU, Price, Title — **requires `all_list = 1`** |
| `accounting.ebay_order_expenses` | one row per fee event | **Ad Spend** (`AD_FEE` + `PREMIUM_AD_FEES`) |

**Verified September coverage** (counts only, no extraction performed):

| Source | Sept 2025 (LY) | Sept 2026 (TY, partial) |
|---|---|---|
| `ebay_traffic_data` | 369,101 rows / 14,630 item_ids / 28 days | 333,628 rows / 13,523 item_ids / 26 days |
| `listing_performance` | 394,605 rows / 9,188 listings | 338,521 rows / 9,928 listings / 28 days |
| eBay orders (joined) | 2,076 item_ids / 2,502 SKUs / 12,723 units | 1,795 item_ids / 2,072 SKUs / 7,776 units |

---

## Field mapping

| # | Dashboard field | Source | Status | Note |
|---|---|---|---|---|
| 1 | eBay ID | `order_item_info.item_id`, `ebay_traffic_data.item_id`, `ebay_listings.item_id` | **VERIFIED** | Present in all three. `listing_performance.ebay_listing_id` is documented as "the eBay item id" |
| 2 | SKU | `ebay_listings.sku` / `parent_sku`; `order_item_info.item_sku` / `real_sku` | **PARTIAL** | Four candidate columns. Which is authoritative is **PENDING ANALYSIS #12**. `all_list = 1` is mandatory on the listing table |
| 3 | LY Sales | `orders` x `order_item_info`, `source_name='EBAY'`, Sept 2025 | **PARTIAL** | Data confirmed present. Revenue formula is **PENDING ANALYSIS #4**; price/qty columns are `character varying` |
| 4 | TY Sales | same, Sept 2026 partial | **PARTIAL** | As above, plus partial-month caveat |
| 5 | YoY % | derived from 3 and 4 | **PENDING ANALYSIS** | Cannot be finalised before #4. Division-by-zero handling where LY = 0 is undefined |
| 6 | LY Ad Sales | `listing_performance.sale_amount_listing_currency` (or `..._payout_currency`) | **PARTIAL** | Under-attributes Promoted Advanced by ~25%; still the only per-listing source. Currency basis is **PENDING ANALYSIS #9** |
| 7 | TY Ad Sales | same, Sept 2026 partial | **PARTIAL** | As above |
| 8 | LY Views | `ebay_traffic_data.ebay_views`, `external_views` | **PARTIAL** | Both columns exist and are separate. Which constitutes "Views" is **PENDING ANALYSIS #5** |
| 9 | TY Views | same | **PARTIAL** | As above. Traffic ends 2026-09-26, two days short of orders/ads |
| 10 | LY Orders | `orders` / `order_item_info` | **PARTIAL** | Order count vs line count vs units is **PENDING ANALYSIS #6** |
| 11 | TY Orders | same | **PARTIAL** | As above |
| 12 | LY Conversion % | `ebay_traffic_data.str`, `listing_performance.conversion_rate`, or derived | **PENDING ANALYSIS** | Three competing sources, all present. Definition required — **#7** |
| 13 | TY Conversion % | same | **PENDING ANALYSIS** | As above |
| 14 | LY Price | no historical source | **PENDING ANALYSIS** | `ebay_listings.price` is **current state only**; no price-history table exists in `ledsone`. Sept-2025 list price is **not stored**. Realised average selling price from order lines is the only derivable alternative — **#8** |
| 15 | TY Price | `ebay_listings.price` (current), or derived | **PARTIAL** | Current price is not September-2026 price. Same decision as #14 |
| 16 | Ad Impressions | `listing_performance.impressions` | **VERIFIED** | Distinct from `ebay_traffic_data.impressions` (organic). Which the dashboard means should be confirmed |
| 17 | Ad Clicks | `listing_performance.clicks` | **VERIFIED** | |
| 18 | Ad Spend | `accounting.ebay_order_expenses`, `AD_FEE` + `PREMIUM_AD_FEES` | **PARTIAL** | Verified rule: this is the billing record, and both fee types are required. These two fee types **do** carry a real listing id (unlike FVF/refund rows). Do **not** also add `listing_performance.ad_fees_*` — that double-counts |
| 19 | Ad Sales (output column) | `listing_performance.sale_amount_*` | **PENDING ANALYSIS** | Whether column 19 is TY Ad Sales, a LY/TY delta, or another metric — **#11** |
| 20 | ROAS / ACoS | `listing_performance.return_on_ad_spend` (stored) | **PARTIAL** | ROAS is stored. ACoS is **not** stored and must be derived. Formula and whether to recompute ROAS are **PENDING ANALYSIS #10** |
| 21 | Segment | not stored anywhere | **PENDING ANALYSIS** | A/B/C/D must be computed. Rules B and D have no numeric threshold; precedence is undefined — **#1, #2, #3** |
| F1 | **Account filter** | `order_management.sub_source` joined via `source.source_name = 'EBAY'` | **VERIFIED** | 13 accounts with September activity; 9 further sub_sources with none in either year. `ebay_traffic_data.sub_source` and `ebay_campaigns.campaigns.sub_source` both FK to the same lookup |
| F2 | **Segment filter** | depends on field 21 | **PENDING ANALYSIS** | |

---

## Verified accounts (Account filter values)

eBay sub_sources with September activity in either year:

`led_sone` (LEDSone), `electricalsone`, `so_926407` (Sunsone), `coventrylights`,
`ledsonede` (LEDSone DE), `huettenlampen`, `vintageinterior`, `dctransformer`,
`lighting_sone`, `re6865` (Retroled), `homin_gmbh`, `neighbourmarket`, `bestbringer`.

Nine further eBay sub_sources exist with zero September orders in both years
(`electro_shine`, `uk-lightsway`, `electbout0`, `koneswaransrikanesh`, `nanthinvasude-0`,
`ur26574`, `cottagelighting`, `longtek020`, `ledpedia`). Whether to list them is
**PENDING ANALYSIS #13**.

---

## Join paths

| From | To | Key | Status |
|---|---|---|---|
| `orders` | `order_item_info` | `order_item_info.order_id = orders.id` | **VERIFIED** — used in Discovery |
| `orders` | `sub_source` | `orders.sub_source_id = sub_source.id` | **VERIFIED** |
| `sub_source` | `source` | `sub_source.source_id = source.id`, `source_name = 'EBAY'` | **VERIFIED** |
| `order_item_info` | `ebay_listings` | `item_id` + `all_list = 1` | **PARTIAL** — variation listings share one `item_id`; grain is **PENDING ANALYSIS #12** |
| `ebay_traffic_data` | listing | prefer `item_id`; `ebay_listing_id` resolves only ~81% | **PARTIAL** — unresolved ids mean ended listings, not broken data |
| `listing_performance` | `campaigns` | `campaign_id` | **VERIFIED** — required to get `marketplace_id` before totalling money |
| `ebay_order_expenses` | listing | `item_id` **only for** `AD_FEE` / `PREMIUM_AD_FEES` | **PARTIAL** — other fee types carry a transaction id and must route via `order_id` |

---

## Known traps carried into this map

1. `attributed_sales` and `sold` are **counts**, not money.
2. `sale_amount_listing_currency` **mixes GBP and EUR** — group by `marketplace_id` first.
3. `sale_amount_payout_currency` reads **0.00** where payouts have not settled.
4. eBay **attributed sales are not revenue** — use order data for money.
5. `listing_performance` and `campaign_performance` sales must **never be added or compared** — same money, different attribution.
6. Listing tables **must** be filtered `all_list = 1`.
7. `ebay_order_expenses.transaction_amount` is **duplicated** across fee-type rows sharing a `transaction_id` — dedup before summing.
8. The Windows PostgreSQL copy is **frozen** since 2026-07-29 — always query through the MCP (VPS).

---

## Nothing invented

No mapping in this document was guessed. Every table and column named was read from
`information_schema` or from the shared knowledge base during Discovery. Fields without a
verified source are marked PENDING ANALYSIS rather than assigned a plausible one.
