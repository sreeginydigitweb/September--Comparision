# Analysis — V1 Locked Decisions

Created 2026-09-28. Fast-track Analysis. These decisions are **implementation-ready**.
Supersedes the PENDING ANALYSIS list in `project-baseline.md` for V1 only.

Every decision below is either **(R)** an existing verified business rule, or **(V1)** an
operational definition adopted to ship V1. V1 decisions are implementation choices, not
business-owner rules, and are marked as such.

---

## 1. Row grain — LOCKED

**Grain: `Account (sub_source) + eBay item_id`.**

**This is a deliberate deviation from the instructed `Account + item_id + SKU` grain.**
Measured reason:

| Check | Result |
|---|---|
| eBay item_ids with `all_list = 1` | 31,152 |
| …of those carrying **more than one SKU** | **28,768 (92%)** |
| Maximum SKUs on a single item_id | **245** |

Traffic (`ebay_traffic_data`) and ad performance (`listing_performance`) exist **only at
item_id grain**. Adding SKU to the key would force every Views, Impressions, Click,
Ad Sales and Ad Spend figure to be repeated across up to 245 SKU rows — fabricated
allocation, and the row multiplication the brief explicitly forbids.

**The instruction's intent is preserved:** the same SKU is never merged across accounts
or listings, because Account and item_id are both in the key.

**SKU is carried as a display attribute, not a key:**

- listing has exactly one `all_list = 1` SKU → show that SKU
- listing has several → show `parent_sku` plus `"N variations"`

Sales and units roll up from SKU to item_id losslessly, so no revenue is lost.

**Exclusions (R):** `listings.ebay_listings` is always filtered `all_list = 1`
(`business/rules/ebay-listing-sku-filter.md`). No new exclusion rule invented.
`wrong_sku` is **not** used as an exclusion — the verified rule names `all_list` only.

---

## 2. Sales — LOCKED (R)

**An authoritative rule exists and overrides the V1 default.**

`business/queries/ph-sales-by-channel.md` defines eBay item-level revenue as:

```
CAST(oii.item_quantity AS INT) * CAST(oii.item_price AS DECIMAL(10,2))
```

**Formula:**

```
Sales = SUM( CAST(oii.item_quantity AS INT)
           * CAST(oii.item_price AS DECIMAL(10,2)) )
Units = SUM( CAST(oii.item_quantity AS INT) )
```

**Difference from the V1 default, documented:** the brief allowed "verified realised line
revenue", which suggested `real_price` / `real_qty`. The authoritative rule uses
**`item_price` / `item_quantity`**, and that is what V1 uses. `real_*` is not used.

**Mandatory guards (R):**
- `sub_source.source_id = 2` — `order_item_info.item_id` also stores Shopify product ids;
  without this filter Shopify rows leak in.
- `item_price` / `item_quantity` are `VARCHAR` — always CAST.
- No allocation of `orders.total` or `orders.sub_total` across lines.

**Windows:** LY `2025-09-01 → 2025-09-30`; TY `2026-09-01 → 2026-09-30` (partial, ends
2026-09-28).

---

## 3. YoY % — LOCKED (V1)

```
LY > 0            →  ((TY - LY) / LY) * 100
LY = 0 and TY > 0 →  "NEW"
LY = 0 and TY = 0 →  "N/A"
```

`NEW` and `N/A` are strings, sorted last ascending. No infinity, no null arithmetic.

---

## 4. Views — LOCKED (V1)

```
Views = SUM(business_reports.ebay_traffic_data.ebay_views)
```

`external_views` is **not** added — no verified rule defines total views that way.
`impressions` from this table is organic and is **not** the dashboard's Ad Impressions.

**Grain (verified):** exactly one row per `item_id + sub_source + site_code + date`
(max 1 confirmed) — safe to aggregate without dedup.

> **TY traffic ends 2026-09-26**, two days short of sales and ads. Displayed, not corrected.

---

## 5. Orders — LOCKED (V1)

```
Orders = SUM( CAST(oii.item_quantity AS INT) )   -- units sold
```

Units, not distinct order count: units is the measure reliably joinable at item_id grain,
and it is the same number used as the ASP denominator, keeping Price and Conversion
internally consistent. **Identical definition for LY and TY.**

---

## 6. Conversion % — LOCKED (V1)

```
Views > 0  →  (Orders / Views) * 100
Views = 0  →  "N/A"
```

Organic listing conversion. `listing_performance.conversion_rate` (PPC) and
`traffic_data.str` are **not** mixed in.

---

## 7. Price = Average Selling Price — LOCKED (V1)

No price-history table exists. Internal name **ASP**; the table keeps the supplied
`LY Price` / `TY Price` labels.

```
Units > 0  →  ASP = Sales / Units
Units = 0  →  "N/A"
```

At item_id grain this averages across variations — stated in the UI footnote.

---

## 8. Ad Sales, Impressions, Clicks — LOCKED (R + V1)

Source: `ebay_campaigns.listing_performance`, joined `ebay_listing_id = item_id`.

**Verified joinable:** 9,915 of 9,928 September-2026 `ebay_listing_id` values match
`listings.ebay_listings.item_id` (99.9%).

```
Ad Sales        = SUM(sale_amount_listing_currency)
Ad Impressions  = SUM(impressions)
Ad Clicks       = SUM(clicks)
```

**Standalone column 19 `Ad Sales` = TY Ad Sales** (V1).

**Guards (R):** `attributed_sales` and `sold` are **counts, not money** — never used as
money. `campaign_performance` is never added to or compared against this table.
Known limit: under-attributes Promoted Advanced by ~25%.

---

## 9. Ad Spend — LOCKED, WITH A DOCUMENTED DEVIATION (V1)

**Decision: Ad Spend = `SUM(listing_performance.ad_fees_listing_currency)`.**

**This deviates from the verified rule** in `business/rules/ebay-ppc-cost-sources.md`,
which names `accounting.ebay_order_expenses` (`AD_FEE + PREMIUM_AD_FEES`) as the cost
source. The deviation is forced by measured data coverage:

| Month | `ebay_order_expenses` ad-fee rows | Fee | Max date |
|---|---|---|---|
| 2026-06 | 24,763 | 16,671.89 | 2026-06-30 |
| 2026-07 | 25,425 | 17,505.93 | 2026-07-31 |
| 2026-08 | 23,665 | 17,228.14 | 2026-08-31 |
| **2026-09** | **1,412** | **1,267.77** | **2026-09-03** |

**The approved billing source holds only 3 days of TY September** (settlement lag).
Sept 2025 has 26,624 rows / 25,231.80. Using it would compare ~30 days of LY spend
against ~3 days of TY spend and make every TY ROAS read roughly 10–20x too high —
a worse error than the one the rule exists to prevent.

`listing_performance` is complete for both periods (Sept 2026 ad fees 14,733.27,
consistent with Jun–Aug) and is at the exact required grain.

**Controls:**
- `ebay_order_expenses` fees are **not added on top** — the double-count the rule warns
  about does not occur, because only one source is used.
- Spend and Ad Sales come from the **same attribution basis**, so ROAS/ACoS are coherent.
- The dashboard labels Ad Spend as *"eBay Promoted Listings reported ad fees — performance
  report, not the billing record"*.
- **Revisit when settlement catches up.** This is a V1 coverage decision, not a
  correction to the rule. The rule remains right for a P&L.

---

## 10. ROAS / ACoS — LOCKED (V1)

```
Ad Spend > 0 → ROAS = Ad Sales / Ad Spend
Ad Spend = 0 → ROAS = "N/A"
Ad Sales > 0 → ACoS = (Ad Spend / Ad Sales) * 100
Ad Sales = 0 → ACoS = "N/A"
```

Both computed by us from column 18 and column 19 — `return_on_ad_spend` is **not** read,
so the ratio always matches the two columns beside it. Displayed as
`ROAS 4.21 · ACoS 23.8%`.

---

## 11. Currency — LOCKED (V1)

`sale_amount_listing_currency` and `ad_fees_listing_currency` are in the **listing site's**
currency and mix GBP/EUR/USD (R). Verified September 2026 spans `EBAY_GB` and `EBAY_DE`
in the same account (`led_sone` trades on both).

**Rules:**
1. Add `marketplace_id` (from `ebay_campaigns.campaigns`) and `site_code` (traffic) to the
   aggregation key, and derive **`currency`** per row: `EBAY_GB`→GBP, `EBAY_DE`→EUR,
   `EBAY_US`→USD, `EBAY_FR`→EUR.
2. **Never sum across currencies.** KPI totals are computed **per currency** and shown as
   separate figures. No blended total is ever displayed.
3. `*_payout_currency` is **not** used — it reads 0.00 where payouts have not settled.
4. Never mix listing and payout currency in one calculation.

> Row identity therefore carries `marketplace` alongside Account + item_id. A listing sold
> on two marketplaces produces two rows, correctly, in two currencies.

---

## 12. Segmentation — LOCKED (V1)

**One primary segment per row.** Precedence is a **V1 implementation choice**, not a
business-owner rule:

```
1. D   LY Sales > 0  AND  TY Sales = 0
2. C   LY Ad Sales > 0  AND  TY Ad Sales = 0
3. B   TY Sales < LY Sales
       AND TY sales(last 7 available TY days) > TY sales(preceding 7 days)
       AND the listing has >= 14 usable TY days
4. A   TY Sales > LY Sales
5. Other   everything else
```

- **D** uses `TY Sales = 0` exactly. No monetary tolerance invented; deliberately
  conservative. The supplied rule says "approximately 0" and remains unresolved.
- **B** windows against the **latest TY order date present** (2026-09-28): days 22–28 vs
  15–21. Fewer than 14 usable TY days → not classified B.
- **C conceptually overlaps A, B and D.** V1 resolves this by precedence so the Segment
  filter can be single-valued. A row that is both C and A is filtered as C.
- **Other** covers `TY = LY`, both zero, declining-without-recovery, and insufficient
  recovery history.

The dashboard shows a footnote: *"Segment precedence D→C→B→A is a V1 implementation rule
pending business confirmation."*

---

## 13. Workflow stage coverage

| Stage | V1 |
|---|---|
| 1 ID Selection | Built |
| 2 YoY Segmentation | Built |
| 3 Ad-Sales Gap | Built (Segment C + LY/TY Ad Sales) |
| 4 Traffic Analysis | Built (LY/TY Views) |
| 5 Conversion Analysis | Built |
| 6 Price Analysis (own) | Built as ASP |
| 6 Competitor price | **Not built** — no verified eBay source |
| 7 Listing Analysis | **FOLLOW-UP DIAGNOSTIC — SOURCE NOT VERIFIED FOR LY-vs-TY V1.** No 2025 listing snapshot exists |
| 8 Demand Analysis | **FOLLOW-UP DIAGNOSTIC — SOURCE NOT VERIFIED FOR LY-vs-TY V1.** No eBay Product Research / sold-data source in `ledsone` |
| 9 Ad Optimization | Built (Impressions, Clicks, Spend, Ad Sales, ROAS/ACoS) |

Stages 7 and 8 are documented, not fabricated, and do not block V1.

---

## 14. V1 limitations (genuine only)

1. **TY September is partial** and the three sources end on different days — traffic
   2026-09-26, sales and ads 2026-09-28. Every TY and YoY figure is understated.
2. **Ad Spend is the performance-report figure, not the billing record** (§9), because the
   billing record holds only 3 TY days.
3. **Ad Sales under-attribute Promoted Advanced by ~25%** — inherent to the only
   per-listing source.
4. **No historical price** — LY/TY Price are realised ASP, not list price.
5. **ASP averages across variations** at item_id grain.
6. **Multi-currency** — GBP/EUR/USD are never summed together.
7. **Segment B** needs ≥14 TY days; sparse listings fall to Other.
8. **Segment D is strict** (`TY = 0`), so near-dead listings land in Other.
9. **Stages 7 and 8 absent** (§13).
10. Snapshot only — TY figures change on every re-run while September is open.
