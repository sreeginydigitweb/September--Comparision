# Capability — September LY vs TY eBay Comparison

What **September - Comparision** can and cannot do. Created 2026-09-28.

## What it does

Given eBay data in `ledsone`, read-only, it produces a **September LY vs TY comparison**
covering:

- **LY = September 2025** (full month) against **TY = September 2026** (partial)
- a 21-column table per listing: eBay ID, SKU, LY/TY Sales, YoY %, LY/TY Ad Sales,
  LY/TY Views, LY/TY Orders, LY/TY Conversion %, LY/TY Price, Ad Impressions,
  Ad Clicks, Ad Spend, Ad Sales, ROAS / ACoS, Segment
- **YoY calculation** from LY and TY sales
- **A/B/C/D segmentation** — YoY Winner, YoY Recovery, Lost Ad Sales, Lost Performer
- an **Account filter** over the eBay seller accounts in `order_management.sub_source`
- a **Segment filter** over A/B/C/D
- a **dashboard-output data contract** the page is generated from

## What it does not do

- **It does not decide the business rules.** Segment B's "recent sales are improving"
  and Segment D's "approximately 0" have no numeric definition, and this project will
  not invent one. Segment precedence is likewise undefined.
- **It does not use `analytics.ph_segment`.** That is a different segmentation
  (HHH/HHL/HLH/LHH/LLH/LLL), in a different database, unrelated to this task.
- It does not create a cross-database dependency for any reason.
- It does not write to any database.
- It does not extend beyond September, or beyond eBay.
- It does not day-cap LY to match a partial TY unless Analysis decides to.
- It does not estimate, interpolate or carry forward a figure it cannot source.

## Boundaries

| Boundary | Where it is enforced |
|---|---|
| `ledsone` only, read-only | MCP role `dbhub_readonly` holds `SELECT` only; Hard Constraints in `.agents/skills/september-yoy-segmentation/SKILL.md` |
| No `order_management_copy` / `ph_segment` | Hard Constraint 2; verification step 7; `duplicate-risk-reports/initial-duplicate-risk.md` |
| No invented thresholds | The skill's "Stop here" section; `documentation/project-baseline.md` PENDING ANALYSIS list |
| eBay only | `order_management.source.source_name = 'EBAY'` |
| September only | Hard Constraint 4 |
| Real SKUs only | `all_list = 1` on every listing-table read |
| TY labelled partial | Hard Constraint 5; verification step 3 |
| No hand-typed figure | Verification step 5 |

## Stated limits

- **TY September 2026 is incomplete**, and the three sources do not even end on the same
  day (traffic 2026-09-26; ads and orders 2026-09-28). Every TY and YoY figure is
  understated for partly calendar reasons.
- **There is no price history.** `listings.ebay_listings.price` is current state only.
  September 2025 list price is not stored anywhere in `ledsone` and cannot be recovered.
- **Per-listing ad sales under-report Promoted Advanced by ~25%** — a known limit of the
  only per-listing source, not a defect to be fixed here.
- **There is no 2025 listing snapshot**, so an LY-vs-TY comparison of title, images,
  item specifics or description is not possible from this source.
- **No verified eBay demand or competitor-price source exists** in `ledsone`.
- The comparison is a **point-in-time snapshot**; re-running on a later date produces
  different TY figures while TY September remains open.

## Capabilities this project does NOT claim

It is not a multi-month dashboard, not a P&L, not an Amazon or Shopify comparison, and
not a replacement for the PPC dashboard. It does not reconcile to eBay Seller Hub —
per-listing attribution cannot.
