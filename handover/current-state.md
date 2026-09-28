# Handover — Current State

Updated 2026-09-28, end of Stage 5 (Skill + Final Validation). **TASK COMPLETE.**

## Where the project is

| | |
|---|---|
| **Stage 1 — Discovery** | COMPLETE |
| **Stage 2 — Structure & Skill Setup** | COMPLETE |
| **Stage 3 — Analysis (fast-track)** | COMPLETE — `documentation/analysis-v1-decisions.md` |
| **Stage 4 — Build** | COMPLETE |
| **Stage 5 — Skill + Final Validation** | **COMPLETE — PASS.** See `validation/final-validation.md`, `closure/task-complete.md` |
| **Next** | Business review of the three V1 implementation rules (below). Nothing blocks use of the dashboard |

## Running the dashboard

Page title: **September Performance Comparison — LY vs TY**. eBay ID and SKU are frozen
horizontally; Segment badges carry descriptive labels and per-rule tooltips.
**Download CSV** exports the full current filtered set (not just the rendered rows),
plus a trailing Currency column so money values are never ambiguous.


```
cd "C:\Users\LED 309\OneDrive\Documents\September -Comparision"
npm start          # -> http://localhost:3000
npm run validate   # re-runs the data gates
```

No dependencies are installed and none are needed — Node built-ins only
(`node --version` v24.20.0). If port 3000 is busy the server steps up to 3001+ and prints
the URL it bound to.

**To refresh the data:** re-run the combined extraction (see `sql/` packs and
`evidence/extract-2026-09-28/counts.md`), then
`node build/build.mjs <extract.json> && npm run validate`.

## Build result

17,845 rows · A 1,318 · B 93 · C 77 · D 1,305 · Other 15,052.
All 16 data gates and all browser gates PASS, 0 console errors.
Final validation also PASS; 2 MAJOR rulebook conflicts were found in the project skill and fixed (docs only, no code change).
Records: `validation/stage-3-build.md`, `validation/final-validation.md`, `closure/task-complete.md`.

## What to read first

1. `documentation/analysis-v1-decisions.md` — **the authority.** Every locked metric
   formula, the row grain, the Ad Spend deviation (§9) and the segmentation rules
2. `closure/task-complete.md` — what was delivered, how to run it, the limitations
3. `documentation/project-baseline.md` — original scope and the segment rules as supplied
   (its PENDING ANALYSIS list is now resolved by the analysis in item 1)
4. `data-maps/source-data-map.md` — every field mapped to a verified `ledsone` source
5. `.agents/skills/september-yoy-segmentation/SKILL.md` — the project rulebook and pipeline
6. `validation/final-validation.md` — what was checked at close, and how

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

1. **Ad Spend — two sources, and V1 does not use the one the rule names.** The verified
   P&L rule is `accounting.ebay_order_expenses` (`AD_FEE + PREMIUM_AD_FEES`), and the
   performance-table fees must never be added on top of it. **V1 uses
   `listing_performance.ad_fees_listing_currency` alone**, because the billing source holds
   only ~3 days of TY September (max 2026-09-03). One source only, so no double-count.
   See `documentation/analysis-v1-decisions.md` §9 — revisit when settlement catches up.
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

## Open questions for the business (V1 shipped with documented interim answers)

All of these are **implemented and working** under V1 operational definitions. None blocks
use of the dashboard; each is a one-line change if the business decides differently.

1. Segment B — "recent sales are improving" → V1: latest 7 TY days > preceding 7 TY days
2. Segment D — "approximately 0" → V1: TY Sales exactly 0 (deliberately conservative)
3. Segment precedence → V1: D → C → B → A → Other, one label per row
4. Revenue definition → **resolved by an authoritative rule**, not a V1 guess:
   `item_price × item_quantity` (`business/queries/ph-sales-by-channel.md`)

## Next action

Business review of the V1 rules that are implementation choices, not owner decisions:
segment precedence D->C->B->A, Segment D requiring TY Sales exactly 0, the Segment B
7-day recovery window, and the Ad Spend source deviation (section 9 of the analysis).
Each is documented and each is a one-line change once confirmed.
