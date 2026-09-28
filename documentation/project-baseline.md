# September - Comparision — Project Baseline

Authoritative scope and decision record. Created 2026-09-28.
Extends the Initial Discovery Report (see `handover/`).

---

## Project

**September - Comparision** — a September LY vs TY eBay performance comparison dashboard.

| | |
|---|---|
| **Scope** | eBay only, September only |
| **LY** | September 2025 (full month) |
| **TY** | September 2026 — **partial / current available data** |
| **Primary source** | `ledsone` PostgreSQL — **READ / SELECT ONLY** |
| **Stage at writing** | Structure & Skill Setup complete; Analysis not started |

### Partial TY decision — USER APPROVED 2026-09-28

The user explicitly approved comparing **partial September 2026** against **full September 2025**.

- TY September is incomplete and this is accepted.
- The project is **not** blocked by September 2026 being unfinished.
- This is **not** silently converted into a like-for-like day-capped comparison.
  Any such conversion requires an explicit Analysis decision.

**Observed TY coverage at 2026-09-28** (FACT, from Discovery):

| Source | Latest date | Days present in Sept 2026 |
|---|---|---|
| `business_reports.ebay_traffic_data` | 2026-09-26 | 26 |
| `ebay_campaigns.listing_performance` | 2026-09-28 | 28 |
| `order_management.orders` | 2026-09-28 | 28 |

> WARNING: The three sources do **not** end on the same day. Any TY total therefore mixes a
> 26-day traffic window with a 28-day sales and ads window. This is a consequence of the
> approved partial-TY decision and must be stated on the dashboard. Whether to align them
> is an Analysis decision, not an assumption to be made here.

> WARNING: Every TY figure is understated relative to LY because the month is incomplete.
> YoY % will read negative for reasons that are partly calendar, not performance.
> The dashboard must label TY as partial wherever a TY or YoY figure is shown.

---

## Expected final table

One row per listing (grain PENDING ANALYSIS), with these columns:

| # | Column |
|---|---|
| 1 | eBay ID |
| 2 | SKU |
| 3 | LY Sales |
| 4 | TY Sales |
| 5 | YoY % |
| 6 | LY Ad Sales |
| 7 | TY Ad Sales |
| 8 | LY Views |
| 9 | TY Views |
| 10 | LY Orders |
| 11 | TY Orders |
| 12 | LY Conversion % |
| 13 | TY Conversion % |
| 14 | LY Price |
| 15 | TY Price |
| 16 | Ad Impressions |
| 17 | Ad Clicks |
| 18 | Ad Spend |
| 19 | Ad Sales |
| 20 | ROAS / ACoS |
| 21 | Segment |

## Filters

- **Account** — eBay seller account (`order_management.sub_source`)
- **Segment** — A / B / C / D only

---

## Primary segments — as supplied, unmodified

| Seg | Name | Rule as supplied | Main action |
|---|---|---|---|
| **A** | YoY Winner | `TY Sales > LY Sales` | Increase visibility / ad opportunity; monitor price and conversion |
| **B** | YoY Recovery | `TY Sales < LY Sales` **but recent sales are improving** | Scale the actions that are improving sales |
| **C** | Lost Ad Sales | `LY Ad Sales > 0 AND TY Ad Sales = 0` | Check campaign, traffic, price and conversion |
| **D** | Lost Performer | `LY Sales > 0 AND TY Sales is approximately 0` | Check Traffic + Listing + Price + Demand + Ads |

### Segment scope decision — USER CONFIRMED 2026-09-28

**"Segment" in this project means the A/B/C/D scheme above and nothing else.**

`analytics.ph_segment` (in the `order_management_copy` database, using HHH / HHL / HLH /
LHH / LLH / LLL performance codes) is **unrelated to this task and is OUT OF SCOPE**.
It must not be used, and no cross-database dependency may be created to obtain it.
See `duplicate-risk-reports/initial-duplicate-risk.md`.

---

## Verified business rules imported from the shared knowledge base

These are pre-existing, verified rules. They are reused rather than re-derived.

| Rule | Effect on this project | Source |
|---|---|---|
| **`all_list = 1` is mandatory** on every listing table, without exception | Any read of `listings.ebay_listings` must filter `all_list = 1`, or parent container rows (which carry no real SKU) inflate and duplicate results | `business/rules/ebay-listing-sku-filter.md` |
| **Ad cost belongs in `accounting.ebay_order_expenses`**, as `AD_FEE + PREMIUM_AD_FEES` | eBay runs two ad products billed differently; counting one halves the figure. The performance tables are a performance report, not a billing record, and have no currency column | `business/rules/ebay-ppc-cost-sources.md` |
| **Do NOT add `listing_performance` ad fees on top of `AD_FEE`** | That double-counts | `business/rules/ebay-ppc-cost-sources.md` |
| **`listing_performance` under-attributes Promoted Advanced by ~25%** | It is still the only per-listing source, and the only source for Promoted Standard. `campaign_performance` is campaign-grain and cannot produce a per-listing row | `.../tables/listing_performance.md` |
| **`attributed_sales` and `sold` are COUNTS, not money** | Easy to misread beside two money columns. Money is in `sale_amount_*` | `.../tables/listing_performance.md` |
| **`sale_amount_listing_currency` mixes GBP and EUR** | Group by the campaign's `marketplace_id` before totalling. `sale_amount_payout_currency` reads 0.00 where payouts have not settled | `business/rules/ebay-ppc-cost-sources.md` |
| **eBay attributed sales are not revenue** | They count purchases in the attribution window after an ad click. Use order data for money, attributed sales only to judge ad performance | `business/rules/ebay-ppc-cost-sources.md` |
| **`ebay_order_expenses.item_id` is mis-keyed for most fee types** | It holds a 14-digit transaction id on FVF/refund rows and a listing id **only** on `AD_FEE` / `PREMIUM_AD_FEES`. Joining naively puts fees on a phantom item | `business/rules/ebay-ppc-cost-sources.md` |
| **`ebay_traffic_data.ebay_listing_id` resolves ~81%** | The remainder are ended/deleted listings that `listings.ebay_listings` deliberately excludes. Treat as "no longer active", not as a broken FK. Prefer joining on `item_id` | `.../tables/ebay_traffic_data.md` |
| **The MCP reads the VPS instance; the Windows copy is frozen** | Frozen since 2026-07-29. All queries must go through the Ledsone MCP | `infrastructure/postgres-access.md` |

---

## PENDING ANALYSIS

The following are **not resolved** and must **not** be answered by assumption.
No extraction query or segmentation logic may be finalised while these are open.

### Segment rules

1. **Exact YoY Recovery (B) measurable rule** — "recent sales are improving" has no
   definition. Undefined: comparison window, baseline, minimum uplift, and whether it is
   measured in revenue or units.
2. **Exact Lost Performer (D) "approximately 0" threshold** — no tolerance given.
   Undefined: absolute floor, percentage-of-LY floor, or literal zero.
3. **Segment precedence / overlap handling** — the rules demonstrably overlap
   (C can co-occur with A, B and D; B can co-occur with D). Also undefined: whether a row
   carries one segment or several, and what happens to rows matching none
   (`TY Sales = LY Sales`, or both zero).

### Metric definitions

4. **Exact revenue definition** — `real_price x real_qty`, `item_price x item_quantity`,
   `orders.sub_total`, or `orders.total`. Both price/quantity pairs are stored as
   `character varying`.
5. **Exact Views definition** — `ebay_views` alone, or `ebay_views + external_views`;
   and whether `impressions` is reported as a separate column.
6. **Exact Orders definition** — order count, order-line count, or units.
7. **Conversion definition** — stored `traffic_data.str`, stored
   `listing_performance.conversion_rate`, or derived Orders / Views.
8. **Historical / average Price definition** — `ebay_listings.price` is **current state
   only**; there is no price-history table, so September 2025 list price is not stored.
   Decide between realised average selling price from order lines, or accept the gap.
9. **Advertising currency basis** — `*_listing_currency` (mixes GBP/EUR) or
   `*_payout_currency` (0.00 where unsettled).
10. **ACoS calculation** — not stored; ROAS is stored as `return_on_ad_spend`. Decide
    whether ROAS is taken as stored or recomputed, and the ACoS formula.
11. **Output "Ad Sales" definition** — whether column 19 is TY Ad Sales, a LY/TY delta,
    or another metric.
12. **Exact row grain** — per `item_id`, per SKU, or per item_id x account x marketplace.
    eBay variation listings share one `item_id` across parent and children.

### Scope questions

13. Whether ended listings (`is_ended`), `wrong_sku = 1` rows, and the 9 eBay sub_sources
    with zero September activity in both years are included.
14. Currency presentation — September orders span UK, DE and US accounts. Whether the
    dashboard is single-currency and, if so, on what FX basis.
15. Whether stage 7 (Listing) LY-vs-TY comparison is in scope, given no 2025 listing
    snapshot exists, and whether stage 8 (Demand) and competitor price are in scope at
    all, given no verified source.
