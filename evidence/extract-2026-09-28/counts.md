# Extraction Evidence — 2026-09-28

Database: `ledsone` (VPS) via Ledsone MCP as `dbhub_readonly`. **SELECT only.**
Extraction status: **COMPLETE**.

## Source coverage observed

| Source | LY Sept 2025 | TY Sept 2026 | TY max date |
|---|---|---|---|
| `order_management.orders` × `order_item_info` | full month | partial | **2026-09-28** |
| `ebay_campaigns.listing_performance` | full month | partial | **2026-09-28** |
| `business_reports.ebay_traffic_data` | full month | partial | **2026-09-26** |

## Key-space before join (account + item_id)

| Source | Distinct keys |
|---|---|
| Sales | 3,104 |
| Traffic | 17,633 |
| Ads | 12,631 |
| **Union of all three** | **17,843** |

Final dataset after splitting by marketplace: **17,845 rows**.

## Sales reconciliation

Per-currency totals from the built dataset:

| Currency | Rows | LY Sales | TY Sales |
|---|---|---|---|
| GBP | 8,942 | 92,129.93 | 74,369.69 |
| EUR | 5,277 | 43,759.15 | 24,090.12 |
| USD | 3,626 | 1,985.20 | 2,576.02 |

**Cross-check:** LY across all currencies = 92,129.93 + 43,759.15 + 1,985.20 =
**137,874.28**, against the independent Discovery-stage figure of **137,874.50** — a
0.22 difference on 137k, from the formula change (`item_price × item_quantity` per the
authoritative rule, vs `real_price × real_qty` used in Discovery). Confirms the join and
the period filter are correct.

## Ad spend (single source, no double-count)

`ebay_campaigns.listing_performance.ad_fees_listing_currency`, TY September:
GBP 10,165.50 · EUR 4,361.46 · USD 206.31.

## Pack E — approved billing source, NOT used

`accounting.ebay_order_expenses` (`AD_FEE + PREMIUM_AD_FEES`):

| Month | Rows | Fee | Max date |
|---|---|---|---|
| 2025-09 | 26,624 | 25,231.80 | 2025-09-30 |
| 2026-08 | 23,665 | 17,228.14 | 2026-08-31 |
| **2026-09** | **1,412** | **1,267.77** | **2026-09-03** |

This is the evidence for the V1 decision in `analysis-v1-decisions.md` §9: the billing
record holds ~3 days of TY September, so using it would inflate TY ROAS ~10–20×.

## Files

- `pack-f-combined-extract.json` — raw combined extract (2.9 MB), the input to `build/build.mjs`
- `validation-output.txt` — full gate output, all PASS
