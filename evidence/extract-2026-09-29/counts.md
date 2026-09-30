# Extraction Evidence — 2026-09-29 (SALES-ONLY SCOPE CORRECTION)

Database: `ledsone` (VPS) via Ledsone MCP as `dbhub_readonly`. **SELECT only.**
Supersedes `evidence/extract-2026-09-28/`, which used the all-ID population.

## Why this re-extract exists

The senior rejected the V1 population — *"athila ellarda ID m varuthu"* (all the IDs are
turning up) — and restated the requirement as **the sales view report for September 2025
and September 2026 only**. V1 built its rows from a `FULL OUTER` merge of identity, sales,
traffic and ads, so any eBay id that merely existed in a listing, traffic or ad record
entered the dashboard carrying zero sales.

The population is now built from September **sales** and nothing else.

## Population rule

```
COALESCE(ly_sales, 0) > 0  OR  COALESCE(ty_sales, 0) > 0
```

Traffic, advertising and listing identity are `LEFT JOIN`ed onto that population. They
enrich a sales-qualified row; they can never introduce one.

Query: `sql/f-combined-sales-driven.sql`.

## Date scope — proven, not assumed

| Check | Result |
|---|---|
| Distinct year-months contributing to sales | **2** (2025-09, 2026-09) |
| Sales source rows outside September | **0** |
| Sales source rows outside 2025/2026 | **0** |
| LY span | 2025-09-01 → 2025-09-30 |
| TY span | 2026-09-01 → 2026-09-29 (**partial**) |
| Sales source rows in scope | 13,517 |

## Population — before and after

| | V1 (all-ID) | Corrected (sales-driven) |
|---|---|---|
| Rows | 17,845 | **3,134** |
| Rows with LY = 0 and TY = 0 | 14,739 | **0** |
| Sales-qualified rows | 3,106 | **3,134** |

**14,739 zero-sales rows removed.** The corrected population is 3,134 rather than 3,106
because the TY window now runs to 2026-09-29 instead of 2026-09-28, and 28 listings made
their first September 2026 sale on that extra day.

Key-space before the join: sales-qualifying keys **3,134**. The join produced 3,134 rows
against 3,134 distinct `acct + item_id + marketplace` keys — **no row multiplication**.

Enrichment coverage of the 3,134 qualifying rows: identity 3,082 · traffic 3,109 · ads 2,898.

## Source coverage observed

| Source | LY Sept 2025 | TY Sept 2026 | TY max date |
|---|---|---|---|
| `order_management.orders` × `order_item_info` | full month | partial | **2026-09-29** |
| `ebay_campaigns.listing_performance` | full month | partial | **2026-09-29** |
| `business_reports.ebay_traffic_data` | full month | partial | **2026-09-27** |

## Sales reconciliation

Built dataset vs a direct September aggregation over the same population:

| Currency | Rows | LY Sales | TY Sales | LY Units | TY Units |
|---|---|---|---|---|---|
| GBP | 2,250 | 92,129.93 | 77,163.45 | 9,029 | 6,235 |
| EUR | 831 | 43,759.15 | 25,007.78 | 3,648 | 1,786 |
| USD | 53 | 1,985.20 | 2,625.00 | 70 | 86 |

Both sides agree to the penny (gate 18).

**The decisive cross-check:** LY totals are **identical** to the superseded all-ID dataset
(GBP 92,129.93 · EUR 43,759.15 · USD 1,985.20). Removing 14,711 rows removed **no
September revenue** — which is exactly what should happen, because every one of those rows
had zero sales in both Septembers. TY is higher than the old figures only because the TY
window now reaches 2026-09-29 rather than 2026-09-28.

## Segments — recalculated, not preserved

| Segment | V1 (obsolete) | Corrected |
|---|---|---|
| A — YoY Winner | 1,318 | **1,349** |
| B — YoY Recovery | 93 | **80** |
| C — Lost Ad Sales | 77 | **77** |
| D — Lost Performer | 1,305 | **1,296** |
| Other | 15,052 | **332** |
| **Total** | 17,845 | **3,134** |

The old counts are recorded here only as the record of what changed. No code asserts them
any more — `build/standalone.mjs` now derives its expectations from the snapshot.

## Ad spend (single source, no double-count)

`ebay_campaigns.listing_performance.ad_fees_listing_currency`, TY September, over the
corrected population: GBP 9,640.93 · EUR 4,100.71 · USD 186.36.

Lower than the V1 figures (GBP 10,165.50 · EUR 4,361.46 · USD 206.31) because spend on
listings that made no September sale in either year is no longer counted — those listings
are out of scope.

## Files

- `pack-f-sales-driven-extract.json` — raw combined extract (582 KB), input to `build/build.mjs`
- `sales-reconciliation.json` — independent DB aggregation + date-scope proof, asserted by gates 17/18
