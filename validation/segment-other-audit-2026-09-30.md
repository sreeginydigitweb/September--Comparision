# Segment "Other" audit — 2026-09-30

**Requested:** remove `Other` so Segment contains only A / B / C / D.
**Audit outcome:** all 115 `Other` rows genuinely match none of the four business rules — none could
be legitimately classified, so none was force-classified.
**Resolution (see the end of this file):** the business elected to exclude them from the PUBLISHED
VIEW. The dataset is unchanged and still holds all 186 rows for audit.

---

## 1. The four rules, as `Ebay.xlsx` → "Segmentation" states them

| Segment | Rule (verbatim from the sheet) |
|---|---|
| A — YoY Winner | TY Sales > LY Sales |
| B — YoY Recovery | TY Sales < LY Sales but recent sales improving |
| C — Lost Ad Sales | LY Ad Sales > 0 and TY Ad Sales = 0 |
| D — Lost Performer | LY Sales > 0 and TY Sales ≈ 0 |

Operational readings kept as already validated: **B** recovery = last 7 TY days > preceding 7
(anchored on the latest TY order date, 2026-09-29); **C** uses eBay Attributed Ad Sales;
**D** uses TY Sales exactly 0; precedence **D → C → B → A → Other**.

---

## 2. First finding: the existing classification is correct

Every one of the 186 rows was re-tested against all four rules from scratch.

- **Rows whose segment disagrees with strict D→C→B→A precedence: 0**
- **`Other` rows that actually satisfy a rule: 0**

So there is nothing misclassified to reclaim. The 115 `Other` rows are `Other` because they fail
all four rules, not because of an implementation defect. No row can be moved into A/B/C/D without
changing a business rule.

---

## 3. Why each `Other` row fails all four rules

### 3.1 — 109 rows · no activity in either period

LY Sales 0 · TY Sales 0 · LY Ad Sales 0 · TY Ad Sales 0 (verified: max LY Ad Sales across all
109 = **0.00**, max TY Ad Sales = **0.00**).

| Rule | Why it fails |
|---|---|
| A | TY Sales not > LY Sales (0 vs 0) |
| B | TY Sales not < LY Sales (0 vs 0) — there is no decline to recover from |
| C | LY Ad Sales = 0, so the "LY Ad Sales > 0" precondition is not met |
| D | LY Sales not > 0 |

**The structural reason:** all four segments describe a *change* between LY and TY. A listing with
no sales and no ad sales in either period has no change to classify. It is not an edge case or a
data gap — 105 of the 109 have real traffic (views) and 10 have ad spend, so the rows are
legitimate and correctly present; they simply sold nothing in either September.

These are assigned-but-not-selling products, kept visible by the deliberate business decision
("Option 2") recorded in the population rule.

By account: Ledsone 44 · Sunsone 33 · Electricalsone 15 · ledsone uk de 8 · Huttenlampen 5 ·
ledsone de 4. By category: Lamp Shade 101 · Wall Plug 8.

### 3.2 — 6 rows · declining, but not recovering and not lost

These sold in both periods, so they are the substantive cases. Each fails all four:

| eBay ID | Account | LY Sales | TY Sales | LY Ad Sales | TY Ad Sales | last7 | prev7 |
|---|---|---|---|---|---|---|---|
| 164525233292 | Ledsone | 1,210.05 | 515.21 | 1,410.45 | 172.50 | 40.77 | 235.03 |
| 164043595851 | Ledsone | 289.14 | 21.98 | 289.14 | 20.88 | 0.00 | 0.00 |
| 166598501724 | Ledsone | 173.10 | 43.74 | 173.10 | 96.60 | 9.89 | 17.97 |
| 164006555006 | Ledsone | 151.77 | 18.84 | 170.61 | 17.90 | 0.00 | 0.00 |
| 165959895226 | Ledsone | 87.67 | 15.89 | 87.67 | 15.89 | 0.00 | 0.00 |
| 164672130159 | Ledsone | 51.00 | 29.98 | 49.30 | 28.48 | 0.00 | 0.00 |

| Rule | Why it fails, for all six |
|---|---|
| A | TY Sales < LY Sales, so not a YoY winner |
| B | TY Sales *is* < LY Sales, but the recent 7 TY days did **not** improve on the preceding 7 — no recovery signal |
| C | LY Ad Sales > 0 **but TY Ad Sales is also > 0** (17.90 … 172.50), so ad sales were not lost |
| D | TY Sales is **not** 0 — these listings are still selling |

**The business state these six occupy:** *still selling, still advertising, but down year on year
and not yet recovering.* The four segments have no name for it. That is arguably the most
important group on the dashboard — a declining-but-alive listing — and forcing it into A, B, C or
D would misdirect the action attached to each segment (the sheet's "Main Action" column).

---

## 4. Why the requested invariants cannot both hold

The request requires:

```
TOTAL = A + B + C + D        and        TOTAL = LISTINGS SHOWN
```

With 115 rows matching no rule, satisfying both would need one of:

- **dropping 115 of 186 rows** — explicitly forbidden ("No row dropped merely to remove Other"),
  and it would delete 62% of utharsika's assigned products from her own review sheet; or
- **assigning a segment the rules do not support** — explicitly forbidden ("DO NOT fabricate a
  segment", "Do not force-classify them").

So the fix is not a code change. It needs a business rule.

---

## 5. The one place the sheet and the code differ

The sheet says rule D is `LY Sales > 0 and TY Sales ≈ 0` — **approximately** zero. The code uses
**exactly** 0 (the documented conservative reading). Relaxing it to a threshold would capture:

| eBay ID | LY Sales | TY Sales | TY as % of LY |
|---|---|---|---|
| 164043595851 | 289.14 | 21.98 | 7.6% |

**One row of 115.** Even with that change, 114 rows remain unclassifiable, so this does not
unblock the request — and `≈ 0` has no defined threshold, so picking one would be inventing a
business rule. Flagged for the business, not acted on.

---

## 6. Options that would unblock this (business decisions)

| Option | Effect | Cost |
|---|---|---|
| **1. Keep a 5th value, renamed** — e.g. "E — No Movement" / "Stable / No Sales", or split into "No Sales Both Years" (109) and "Declining" (6) | Every row gets a meaningful label; TOTAL = A+B+C+D+E = Listings Shown | Not four values, but it is truthful and actionable |
| **2. Extend the rules to cover them** — e.g. add "E — Declining" (TY < LY, no recovery, TY > 0) and "F — Dormant" (no sales either period) | Same as above, with named rules in the sheet | Requires the sheet to be updated |
| **3. Filter the population to selling products only** | 71 rows, all A/B/C/D, TOTAL = Listings Shown | Reverses the standing "Option 2" decision to keep assigned zero-sales products visible — and that decision was itself a senior correction |
| **4. Relax D to a "≈ 0" threshold** | Reclassifies 1 row | Does not unblock; needs a defined threshold |

Option 1 is the smallest change that satisfies "only four *performance* segments" while keeping
every assigned product visible and honestly labelled.

---

## 7. State — unchanged

| | |
|---|---|
| Segments | D 28 · A 38 · B 2 · C 3 · Other 115 (as published) |
| Rows | 186 |
| Sales / Orders / Views / Conversion / Ad data | **untouched** |
| Account / Category scope | **untouched** |
| `index.html`, cards, filters, CSV | **untouched** |
| `npm run validate` | PASS |
| PH row 1947 | **not updated** |
| Git | no commit, no push |

Evidence: **`validation/other-rows-audit-2026-09-30.csv`** — all 115 rows with LY/TY Sales,
LY/TY Ad Sales, last7/prev7, per-rule fail flags and the exact reason.

---

# RESOLUTION 2026-09-30 — published view restricted to A/B/C/D

The business chose **Option: exclude the unclassified rows from the published view**, keeping the
validated dataset intact. Implemented as a **display/publication scope**, not a data change.

## What was done

`index.html` declares an allow-list and applies it once, at load:

```js
const PUBLISHED_SEGS = ['A', 'B', 'C', 'D'];
SOURCE = d.rows;                                                   // 186 — untouched
DATA    = SOURCE.filter(r => PUBLISHED_SEGS.includes(r.segment));  // 71  — published
```

Everything downstream (filters, cards, counts, sort, pagination, search, CSV export) already read
`DATA`, so the scope applies everywhere from one place. Also removed: the `Other` dropdown option,
the `Other` badge label/tooltip, its CSS class, and the `Other` summary card. `Total` is now summed
from the four published buckets.

**No metric was recalculated.** The filter selects rows; it does not touch a single field.

## Published counts

| | |
|---|---|
| Source rows (dataset, unchanged) | **186** |
| Published rows | **71** |
| A — YoY Winner | **38** |
| B — YoY Recovery | **2** |
| C — Lost Ad Sales | **3** |
| D — Lost Performer | **28** |
| TOTAL (= A+B+C+D = Listings shown) | **71** |
| Unclassified, retained in dataset for audit | **115** |

## What the published view no longer shows — read this

Excluding the unclassified rows removes a large share of the actual trade, because the group
contains the six biggest declining listings:

| | Excluded | Of total | Share |
|---|---|---|---|
| LY Sales | £1,962.73 | £3,182.15 | **61.7%** |
| TY Sales | £645.64 | £2,535.34 | 25.5% |
| LY Orders | 123 | 185 | **66.5%** |
| TY Orders | 31 | 133 | 23.3% |

**The senior's control SKU `164525233292` is one of the excluded rows** — LY £1,210.05 / 62 orders,
the very figures signed off in the raw-data audit. It is Other because it is still selling
(TY £515.21, so not D), still making ad sales (TY Ad Sales £172.50, so not C), down year on year
(so not A) and not recovering (last 7 days £40.77 vs preceding £235.03, so not B).

The other five excluded selling rows: 164043595851 (LY £289.14), 166598501724 (£173.10),
164006555006 (£151.77), 165959895226 (£87.67), 164672130159 (£51.00) — all Ledsone.

The dashboard states this on its face rather than hiding it: the header reads
`71 products · A/B/C/D only (115 unclassified of 186 assigned not shown)`, and the Data Notes
drawer explains which rows are excluded and why, and that they are retained in the dataset.

## Gates added

| Gate | Asserts |
|---|---|
| 49 | published population is exactly A+B+C+D and sums to its own total |
| 50 | page filters by the A/B/C/D allow-list; no `Other` option, label or badge style — checked in **both** `index.html` and the packaged standalone |
| 51 | cards are Listings shown + A/B/C/D + Total; `Other` card gone; Total summed from the four buckets |
| 52 | exclusion is **display-only**: retained rows still match the raw extract, all 25 metric fields intact, and the 115 unclassified rows are still in `data/september-comparison.json` |

`build/standalone.mjs` additionally throws if the packaged page ever loses the allow-list, loses
the load-time filter, regains an `Other` option, or would publish 0 rows.

## Verified in the rendered standalone

- Segment dropdown: exactly **5** options — All segments · A · B · C · D
- Badges rendered: only `A · Winner`, `B · Recovery`, `C · Lost Ads`, `D · Lost Performer`
- `Other` rows in view: **0** · in CSV: **0** (72 lines = header + 71)
- Cards: Listings shown 71 · A 38 · B 2 · C 3 · D 28 · **Total 71**
- Filters operate over the published 71 only: Ledsone → 42, Wall Plug → 4, EUR → 12, Segment D → 28;
  every one reports "filtered from 71" and 0 Other
- 0 console errors. One blocked thumbnail request (`cdn.listingmirror.com`) — expected in headless
  QA, needs internet, not a defect.
