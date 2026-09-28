# sql/

Individual SQL statements written against `ledsone`.

## What belongs here

- SELECT statements only, each with a comment naming what it answers
- Discovery and inspection queries
- Draft extraction queries, clearly marked as draft until Analysis fixes the definitions

## What does not belong here

- **Any statement that writes.** No INSERT, UPDATE, DELETE, ALTER, DROP, CREATE, TRUNCATE.
  `ledsone` is read-only for this project
- Queries against `order_management_copy` / `analytics.ph_segment` — out of scope
- Assembled multi-query runs — those belong in `query-packs/`
- Query results — those belong in `evidence/`
