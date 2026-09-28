# Handover — Current State

Updated 2026-09-28, end of Stage 2.

## Where the project is

| | |
|---|---|
| **Stage 1 — Discovery** | COMPLETE |
| **Stage 2 — Structure & Skill Setup** | COMPLETE (this handover) |
| **Stage 3 — Analysis** | NOT STARTED — awaiting review |

**Nothing has been built.** No dashboard, no extraction SQL, no application code, no
dependencies. The project has structure, documented rules, verified source mappings and
its skills in place.

## What to read first

1. `documentation/project-baseline.md` — scope, LY/TY definition, output table, segment
   rules as supplied, and the 15 PENDING ANALYSIS items
2. `data-maps/source-data-map.md` — every field mapped to a verified `ledsone` source
3. `duplicate-risk-reports/initial-duplicate-risk.md` — what to reuse, what is excluded
4. `.agents/skills/september-yoy-segmentation/SKILL.md` — the project rulebook and pipeline
5. `validation/stage-2-structure-skill-setup.md` — what was checked and how

## Decisions already taken — do not reopen

- **TY = partial September 2026** against **LY = full September 2025**. User approved
  2026-09-28. Do not block on the month being unfinished; do not silently day-cap LY.
- **"Segment" means A/B/C/D only.** `analytics.ph_segment` is out of scope, confirmed by
  the user. Do not reintroduce it or reach into `order_management_copy`.
- The requirement artefacts were supplied externally via ChatGPT and transferred into the
  Discovery prompt. **Their absence locally is not a blocker.** The transferred
  requirements are the working specification.

## Access

- **Use the Ledsone MCP** (`claude.ai Ledsone postgres`). It connects to `ledsone` on the
  VPS as `dbhub_readonly` — verified non-superuser, SELECT only, INSERT/UPDATE/DELETE and
  CREATE all denied.
- **Do not use** `claude.ai postgres (2)` — it connects to `order_management_copy` as the
  `postgres` superuser, which is write-capable, and holds the out-of-scope `ph_segment`
  and the `varman_aios` schema.
- The **Windows PostgreSQL copy is frozen** since 2026-07-29. Always go through the MCP.

## Traps that will otherwise be rediscovered the hard way

1. **Ad Spend is not in `listing_performance`.** Use `accounting.ebay_order_expenses`,
   `AD_FEE + PREMIUM_AD_FEES`. Adding the performance-table fees on top double-counts.
2. **`all_list = 1`** on every `listings.ebay_listings` read, or parent container rows
   inflate and duplicate the result.
3. **`attributed_sales` and `sold` are counts, not money.**
4. **`sale_amount_listing_currency` mixes GBP and EUR** — group by `marketplace_id` first.
5. **`listing_performance` under-attributes Promoted Advanced by ~25%** and must never be
   added to or compared against `campaign_performance`.
6. **`ebay_order_expenses.item_id` holds a listing id only on the two ad-fee types**;
   on FVF and refund rows it is a transaction id.
7. **The three TY sources end on different days** — traffic 2026-09-26, ads and orders
   2026-09-28.

## Open questions for the business (blocking Analysis, not this stage)

The full list is in `documentation/project-baseline.md`. The four that block
segmentation outright:

1. Segment B — what "recent sales are improving" measurably means
2. Segment D — what "approximately 0" tolerates
3. Segment precedence, and whether a row carries one label or several
4. The revenue definition everything else depends on

## Next action

Begin **Analysis**: put the PENDING ANALYSIS items to the business, starting with the
four above. Do not write extraction SQL until the revenue definition and row grain are
settled — every query depends on both.
