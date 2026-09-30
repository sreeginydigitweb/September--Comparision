# Validation — Utharsika product scope (2026-09-29)

The missing authoritative product scope **was found**. It is not a task assignment — it is
a genuine product-portfolio assignment, and it maps cleanly to the two required categories.

## Identity — proven, not assumed

| | |
|---|---|
| Username | `utharsika` |
| PH/User ID | **109** |
| Name / email | Utharsika · utharsika.digitweblanka@gmail.com |
| Status | Active |
| Source | `ledsone` → `staff.users` |

`tech_team_outputs.ph_task.assigned_user` was **not** used to establish this — it only says
who receives a task, as the brief warned.

## Product assignment source

`staff.ph_categories` (PH categories owned by a user) → `staff.ph_category_products`
(the products in each category). Assigned 2026-07-01.

**Utharsika owns exactly two PH categories, and they are the two required ones:**

| ph_category_id | Name in DB | Normalised | Products (all channels) |
|---|---|---|---|
| 66 | `Lampshade` | **Lamp Shade** | 1,874 |
| 67 | `Wall plug` | **Wall Plug** | 326 |

This is the authoritative category source — no keyword guessing and no multi-channel
`product_type` inference. It also explains the leakage: **Bulbs** belong to `thuwaraga`
(ph_category 65) and **Transformer** to `Dilani` (ph_category 13) — different PH owners,
correctly out of scope.

`source_id = 2` is EBAY (`order_management.source`), and those `ref_id` values are eBay
item_ids.

## Match audit

| | |
|---|---|
| Assigned eBay IDs (source_id = 2) | **191 assignments → 186 distinct item_ids** |
| …as Lamp Shade | 173 |
| …as Wall Plug | 13 |
| Matched to `listings.ebay_listings` (`all_list = 1`) | **186 — unmatched 0** |
| Within the six approved accounts | 186 |
| With September 2025 or 2026 sales | **77** |
| **Final dashboard rows** | **77** (77 distinct items — no multiplication) |

The 109 assigned IDs that do not appear simply had no September sales in either year; they
are excluded by the sales rule, not discarded silently.

**Dual assignment:** 5 item_ids sit in both PH categories
(`166598283141`, `166598501724`, `166748372610`, `167707828840`, `267519662345`).
To keep one category per row — and the validated `account + item_id + marketplace` grain —
**Wall Plug wins**, the narrower assignment; 3 of the 5 carry an `RWWP…` SKU prefix.
Documented so the business can reverse it in one line if wrong.

## Final population

**77 rows · 6 accounts · 2 categories · 0 zero-sales · September only.**

| Category | Rows | LY Sales | TY Sales |
|---|---|---|---|
| Lamp Shade | 72 | 2,989.83 | 2,396.81 |
| Wall Plug | 5 | 192.32 | 90.96 |

| Account | Rows | LY Sales | TY Sales |
|---|---|---|---|
| Ledsone | 48 | 2,777.01 | 1,839.98 |
| Sunsone | 11 | 45.16 | 225.13 |
| Electricalsone | 6 | 39.07 | 379.49 |
| ledsone uk de | 6 | 164.23 | 12.49 |
| Huttenlampen | 4 | 66.08 | 30.68 |
| ledsone de | 2 | 90.60 | 0.00 |

Segments: **A 38 · B 1 · C 3 · D 29 · Other 6 · Total 77.** Currencies GBP 65 · EUR 12.

## Test results

| # | Test | Result |
|---|---|---|
| 1 | Utharsika PH/User ID verified | **PASS** — 109, from `staff.users` |
| 2 | Product-assignment source verified | **PASS** — `staff.ph_categories` + `staff.ph_category_products`, not task data |
| 3 | Every product belongs to Utharsika | **PASS** — gate 34, 77/77 within her 186 assigned IDs |
| 4 | Every Category is Lamp Shade or Wall Plug | **PASS** — gate 35 |
| 5 | Other categories / bulbs / transformers / drivers | **PASS** — gate 37, all **0** |
| 6 | Unexpected accounts | **PASS** — gate 22, **0** |
| 7 | Zero-sales rows | **PASS** — gate 15/16, **0** |
| 8 | September 2025 / 2026 only | **PASS** — gate 17 |
| 9 | No row multiplication | **PASS** — 77 keys / 77 rows |
| 10 | Category filter = All / Lamp Shade / Wall Plug | **PASS** — gate 36; 3 options in the browser |
| 11 | Account + Category stacking | **PASS** — Ledsone 48 → + Lamp Shade 45 → + Segment 16 |
| 12 | Download CSV respects filters | **PASS** — 77 unfiltered, header carries SKU ID and Category |
| 13 | Standalone `file://` | **PASS** — 68 KB, 0 console errors, 0 external requests |
| 14 | Per-category reconciliation vs DB | **PASS** — gate 38 |

`npm run validate` — **38/38 gates PASS** (new: 34 allowlist, 35 category allowlist,
36 exactly two categories, 37 no wrong product families, 38 per-category reconciliation).

## PH Priors row 1947 — UPDATED

`html_content` 1,486,619 → **68,632** chars, md5 → **`2f3aaaf37dc1cdf5072a7fcb63586130`**,
matching the source file exactly. Re-verified through a second connection (the MCP, as
`postgres`): subtitle, the utharsika scope line and both categories present; a search for
wrong categories (`Light Bulbs`, `Stromtransformatoren`, `Schaltnetzteile`) returns
**false**.

Only `html_content` and `updated_at` changed; every routing field is untouched and
duplicate rows: **0**.

Evidence: `evidence/extract-2026-09-29/utharsika-ebay-allowlist.json` (the 186 IDs,
identity and category mapping) and `pack-f-utharsika-extract.json`.
