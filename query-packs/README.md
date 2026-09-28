# query-packs/

Grouped, repeatable sets of read-only queries that together produce one output.

## What belongs here

- The September LY/TY extraction set once definitions are agreed
- Per-metric packs (sales, ads, traffic, price) with their run order
- Notes on what each pack returns and what it deliberately leaves out

## What does not belong here

- **Anything that writes to a database**
- Single ad-hoc statements — those belong in `sql/`
- Packs built on unresolved rules. A pack is not finalised while the
  Segment B/D thresholds are still PENDING ANALYSIS
- Results — those belong in `evidence/`
