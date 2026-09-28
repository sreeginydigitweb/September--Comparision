---
name: september-yoy-segmentation
description: >-
    Holds the rules for the September - Comparision project and sequences the
    reusable skills that produce it — establishing the September LY vs TY
    comparison, mapping each dashboard field to its verified `ledsone` source,
    calculating YoY, applying the supplied A/B/C/D segmentation, and defining
    the Account filter, Segment filter and dashboard-output data contract. Use
    when the September LY vs TY eBay comparison must be specified, extracted or
    produced. Orchestrates `postgres-mcp-fetch`, `data-transform` and
    `static-html-generate` rather than reimplementing them. Read-only on
    `ledsone`. Never invents a segment threshold, never uses
    `analytics.ph_segment`, never writes to any database, never commits, never
    pushes.
---

# September YoY Segmentation

This skill is this project's **rulebook and pipeline in one**. It is deliberately a
single skill: the project needs one authority on *what the September comparison is*
and one on *what order it is produced in*, and splitting them here would create two
files that mostly cite each other.

**Project facts in this file are pointers, not authorities.** Re-read
`documentation/project-baseline.md` and `data-maps/source-data-map.md`, and re-read
the database catalogue, on every run. Where this file and those files disagree, they
are right and this file has a correction waiting.

---

## Stop here if a rule below is marked PENDING ANALYSIS

Four things this skill needs are **not yet defined by the business**, and this skill's
most important job right now is to refuse to invent them.

| Pending | What is missing |
|---|---|
| **Segment B threshold** | "recent sales are improving" — no window, no baseline, no minimum uplift, no revenue-vs-units basis |
| **Segment D threshold** | "TY Sales approximately 0" — no tolerance: absolute floor, percentage of LY, or literal zero |
| **Segment precedence** | The rules overlap. Undefined: one label or several per row, and the order they are applied in |
| **Nine metric definitions** | Revenue, Views, Orders, Conversion, Price, ad currency basis, ACoS, output "Ad Sales", row grain — see `documentation/project-baseline.md` |

**Do not pick a plausible number. Do not pick a "sensible default". Do not infer one
from the data's distribution.** If a run reaches a point where one of these is
required, stop and report which one, rather than proceeding on a guess. A threshold
invented here silently becomes the business rule, and nobody will know it was invented.

Segment **A** (`TY Sales > LY Sales`) and Segment **C**
(`LY Ad Sales > 0 AND TY Ad Sales = 0`) are fully defined and may be computed once the
underlying metric definitions are settled.

---

## One job / one trigger

**Job:** produce the September LY vs TY eBay comparison for `ledsone` — the 21-column
table, the Account filter and the Segment filter — under the rules recorded in
`documentation/project-baseline.md`.

**Trigger:** the September comparison must be specified, extracted, refreshed or
produced.

**Not this skill's job:** deciding the business rules (those come from the business,
via Analysis), fetching (that is `postgres-mcp-fetch`), reshaping (that is
`data-transform`), or writing markup (that is `static-html-generate`).

---

## Hard constraints

1. **`ledsone` only, read-only.** SELECT and nothing else. No INSERT, UPDATE, DELETE,
   ALTER, DROP, CREATE, TRUNCATE. The MCP role `dbhub_readonly` enforces this at the
   database, and that is a backstop, not a licence to try.
2. **`analytics.ph_segment` is out of scope.** It lives in `order_management_copy`,
   uses an unrelated HHH/HHL/HLH/LHH/LLH/LLL scheme, and must not be read, joined,
   referenced or reintroduced. "Segment" in this project means A/B/C/D only.
3. **No cross-database dependency.** Do not reach into `order_management_copy`,
   `varmen_db`, `ph_dashboard` or any other database for any reason.
4. **September only.** Do not generalise into a multi-month dashboard without an
   explicit approval recorded in `documentation/`.
5. **TY is partial and must be labelled.** Every TY and YoY figure the project emits
   carries that caveat. Do not quietly day-cap LY to match.
6. **No invented data.** A figure that cannot be sourced is reported missing, not
   estimated, interpolated or carried forward.
7. **`all_list = 1`** on every read of `listings.ebay_listings`, without exception.

---

## Orchestration — which skill does what

This skill **sequences; it does not reimplement.** Four reusable skills are held in
this project because each had to name this project's sources to be useful:

| Skill | Its job here | Never |
|---|---|---|
| `database-check` | Verify the connection, schema, columns and read-only posture before anything is trusted | Writes, or fixes code |
| `postgres-mcp-fetch` | Build and run the read-only September queries and verify the returned shape | Generates HTML |
| `data-transform` | Reshape fetched rows into the 21-column contract, handling null/empty/duplicate honestly | Invents data, generates HTML |
| `static-html-generate` | Produce the dashboard page from verified transformed data | Invents data |

**Do not write an ad-hoc query when `postgres-mcp-fetch` is the fetch path, do not
compute the comparison inline when `data-transform` is the transform path, and do not
hand-write markup when `static-html-generate` is the generator.** None of those four
sequences the others, and that gap is this skill's reason to exist.

---

## The comparison this skill defines

| | |
|---|---|
| **LY** | September 2025, full month |
| **TY** | September 2026, partial — the data that exists at run time |
| **Channel** | eBay only (`order_management.source.source_name = 'EBAY'`) |
| **Grain** | PENDING ANALYSIS — per `item_id`, per SKU, or per item_id x account x marketplace |

**YoY %** is derived from LY Sales and TY Sales once the revenue definition is settled.
Behaviour where `LY Sales = 0` is undefined and is part of the pending set — do not
default it to zero, null, or infinity without a decision.

### Output data contract — 21 columns

eBay ID, SKU, LY Sales, TY Sales, YoY %, LY Ad Sales, TY Ad Sales, LY Views, TY Views,
LY Orders, TY Orders, LY Conversion %, TY Conversion %, LY Price, TY Price,
Ad Impressions, Ad Clicks, Ad Spend, Ad Sales, ROAS / ACoS, Segment.

### Filters

- **Account** — `order_management.sub_source`, joined through `source`. Verified available.
- **Segment** — A / B / C / D. Blocked on the pending thresholds above.

---

## Source rules this skill must not relearn the hard way

These are verified and imported; `data-maps/source-data-map.md` holds the full set.

- Ad **cost** comes from `accounting.ebay_order_expenses` as `AD_FEE + PREMIUM_AD_FEES`.
  Do **not** also add `listing_performance.ad_fees_*` — that double-counts.
- `listing_performance` **under-attributes Promoted Advanced by ~25%**, and is still the
  only per-listing source. Never add or compare it against `campaign_performance`.
- `attributed_sales` and `sold` are **counts, not money**.
- `sale_amount_listing_currency` **mixes GBP and EUR** — group by the campaign's
  `marketplace_id` before totalling.
- eBay **attributed sales are not revenue**.
- `ebay_traffic_data.ebay_listing_id` resolves ~81%; the rest are ended listings, not
  broken data. Prefer joining on `item_id`.
- The Windows PostgreSQL copy is **frozen** since 2026-07-29 — query through the MCP.

---

## Verification

A run is not finished because it produced output. Before handing anything on:

1. **Connection and posture** — confirmed read-only, confirmed `ledsone`, confirmed VPS.
2. **Both periods present** — LY and TY each returned rows; neither silently empty.
3. **TY partiality stated** — the actual TY end date per source is recorded, not assumed,
   and the traffic/sales/ads windows' disagreement is surfaced.
4. **No pending rule was silently resolved** — if a segment or metric definition was
   needed and was not available, the run stopped and said so.
5. **Every emitted figure traces to a named source column** — nothing hand-typed.
6. **No write occurred** — on any database.
7. **`ph_segment` absent** — it appears nowhere in the queries, the data or the output.

A failed check is reported as failed. Loosening a check to make it pass is the one
thing this skill must never do.

---

## Walk down

When something is wrong, walk down from the output to the source rather than guessing
at the middle: the rendered figure, then the transformed row, then the fetched row,
then the query, then the database catalogue. **Where the output and the database
disagree, the database is the fact.** Stop at the first step where the two stop
matching; that is the defect, and everything below it is still innocent.

---

## Bike method

When this file proves wrong — a source moved, a rule was decided, a trap was found —
correct this file in the same run, and say what changed. A rulebook that drifts from
the project is worse than no rulebook, because it is trusted.

**Standing entry:** the four PENDING ANALYSIS blocks above are the live ones. When
Analysis settles a threshold, record it in `documentation/project-baseline.md` first,
then update this file to cite it. The decision lives there; this file points at it.
