# Initial Duplicate & Reuse Risk Record

Created 2026-09-28, at the end of the Structure & Skill Setup stage.

---

## KEY DECISION

> ### `analytics.ph_segment` is OUT OF SCOPE for the A/B/C/D Segment filter.
>
> It is a different segmentation, in a different database, answering a different
> question. It must not be used, joined, referenced, or reintroduced — and no
> cross-database dependency may be created to obtain it.

---

## 1. Reusable skills from `Task 4`

**Found:** `C:\Users\LED 309\OneDrive\Documents\Task 4\.agents\skills\` — 10 skills.
All 10 SKILL.md files were inspected before any decision was taken.

| Skill | Decision | Reason |
|---|---|---|
| `database-check` | **Reused — copied verbatim** | Verifies connection, schema, columns and read-only posture. Needed on every run |
| `postgres-mcp-fetch` | **Reused — copied verbatim** | The read-only fetch path for `ledsone` |
| `data-transform` | **Reused — copied verbatim** | Reshapes fetched rows into the output contract |
| `static-html-generate` | **Reused — copied verbatim** | Produces the dashboard page from verified data |
| `build-validation` | **Not copied** | No build step exists yet. Copy only when there is one |
| `test-validation` | **Not copied** | No tests exist yet |
| `code-review` | **Not copied** | No application code exists yet |
| `debug-error` | **Not copied** | Nothing to debug yet |
| `performance-check` | **Not copied** | Nothing to measure yet |
| `security-check` | **Not copied** | No code or config to inspect yet |

**Duplication accepted, knowingly.** The four copies are **byte-identical** to the
Task 4 originals (md5 verified at copy time). This matches the established house
pattern — `Listing Title` holds the same four as verbatim copies — because a skill must
sit in the project's own `.agents/skills/` to be invocable there.

- **Canonical source:** `Task 4\.agents\skills\`.
- **Risk:** the copies drift if the originals are improved.
- **Control:** do not edit the copies. If one needs project-specific wording, change it
  in the canonical source and re-copy, and record that here.

**Six skills were deliberately not copied.** Copying all ten "because they exist" would
have created six files this project cannot yet use.

---

## 2. Existing schema documentation — reused, not rewritten

The shared knowledge base already documents every table this project needs.
**No schema documentation was recreated.** `data-maps/source-data-map.md` cites it.

| Reused | What it gave us |
|---|---|
| `business/rules/ebay-ppc-cost-sources.md` | Ad cost belongs in `accounting.ebay_order_expenses` as `AD_FEE + PREMIUM_AD_FEES`, **not** the performance tables; adding both double-counts |
| `business/rules/ebay-listing-sku-filter.md` | `all_list = 1` is mandatory on every listing table |
| `.../business_reports/tables/ebay_traffic_data.md` | Grain, site codes, and that `ebay_listing_id` resolves only ~81% by design |
| `.../ebay_campaigns/tables/listing_performance.md` | The ~25% Promoted Advanced under-attribution; counts vs money; currency mixing |
| `infrastructure/postgres-access.md` | `dbhub_readonly` is read-only on `ledsone`; the MCP reads the VPS; the Windows copy is frozen |

**Risk avoided:** the ad-cost rule alone would have been got wrong. The obvious mapping
(`listing_performance.ad_fees_*` → Ad Spend) is the documented **wrong** answer.

---

## 3. Existing PPC dashboard pattern

**Found:** `development/apps/ppc-dashboard/**` in the knowledge base — architecture,
data pipeline, screens, databases-and-access.

**Decision: review before designing, do not fork.** It is an Amazon-centred PPC
management tool with a different purpose (campaign operation, not a YoY comparison).
Its architecture and data-access notes are worth reading at the build stage so this
project does not invent a different way of doing the same thing.

**Action for the build stage:** read `architecture.md` and `databases-and-access.md`
before choosing this project's output approach.

---

## 4. `analytics.ph_segment` naming collision

**The most dangerous item in this record**, because both things are called "segment"
and both are real.

| | Project A/B/C/D Segment | `analytics.ph_segment` |
|---|---|---|
| Values | A, B, C, D | HHH, HHL, HLH, LHH, LLH, LLL |
| Means | YoY Winner / Recovery / Lost Ad Sales / Lost Performer | Champions / Leaky Buckets / Wallflowers / Hidden Gems / Niche Winners / Dead Horses |
| Basis | LY vs TY sales and ad sales | Impressions/clicks/conversions vs category median |
| Grain | September LY vs TY | Rolling 14-day bi-weekly periods |
| Database | `ledsone` (to be computed) | `order_management_copy` |

**Decision: OUT OF SCOPE — confirmed by the user 2026-09-28.**

Additional reasons beyond the user's instruction:

1. It answers a different question and is not a substitute.
2. It would create a **cross-database dependency** that this project is forbidden.
3. Its September coverage is **incomplete for TY** — LY has both bi-weekly periods
   (2025-09-01→14 and 2025-09-15→28), TY has only 2026-09-01→14.
4. The second database is reached as the **`postgres` superuser**, which is
   write-capable — an unnecessary risk for a read-only project.

**Control:** Hard Constraint 2 and verification step 7 in
`.agents/skills/september-yoy-segmentation/SKILL.md`; restated in
`capability/september-comparison-capability.md` and `documentation/project-baseline.md`.

---

## 5. Existing Node / dashboard architecture patterns

**Found:** `Initial-Mini-AIOS` and `Task 4` are Node/npm projects (`package.json` +
`node_modules`). `Listing Title` produces a standalone `index.html` with no database
layer. `Task 4` additionally has `api/` and `share/`.

**Decision: nothing installed, no framework initialised, no `package.json` created.**

This stage does not need a runtime, and the output approach is not yet decided.
Whether this project follows the `Listing Title` standalone-HTML pattern or the
`Task 4` api-backed pattern is a build-stage decision to be taken against the PPC
dashboard review in item 3 — **not** by defaulting to whichever sibling was opened last.

**Risk if ignored:** initialising the wrong pattern now would be harder to unwind than
to decide later.

---

## 6. The 12-folder standard

**Found:** `Initial-Mini-AIOS`, `Task 4` and `Listing Title` all implement it.

**Decision: follow the existing pattern**, including the README "what belongs / what
does not belong" shape, rather than inventing a new convention. `.agents/skills/` was
added because all three siblings use it and a skill is not invocable outside it.

---

## Re-check trigger

Before any new component is proposed, re-check this record. In particular, before
writing a new SKILL, confirm it is not one of the six Task 4 skills not yet copied.
