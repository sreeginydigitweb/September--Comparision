# validation/

Checks that confirm the project's own outputs are correct and internally consistent.

## What belongs here

- Stage validation results (structure checks, file-existence checks)
- Reconciliation checks: totals against source, LY vs TY row coverage
- Rule checks, e.g. that no row is silently assigned an undefined segment
- Records of checks that FAILED, kept as-is

## What does not belong here

- Source evidence — that belongs in `evidence/`
- The rules being validated — those belong in `documentation/`
- Passing a check by loosening it. A failed check stays recorded as failed
