# data-maps/

How each dashboard field maps to a real, verified source in `ledsone`.

## What belongs here

- Field-to-table-to-column mappings, each marked VERIFIED, PARTIAL or PENDING ANALYSIS
- Join paths and the keys they use
- Known traps on a source (currency mixing, counts vs money, mis-keyed columns)
- Any mandatory filter a source requires, e.g. `all_list = 1` on listing tables

## What does not belong here

- Mappings that have not been checked against the database
- Business rules — those belong in `documentation/`
- SQL — that belongs in `sql/` or `query-packs/`
