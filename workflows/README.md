# workflows/

The ordered processes this project follows.

## What belongs here

- The supplied 9-stage analysis workflow (ID selection → YoY → ad gap → traffic →
  conversion → price → listing → demand → ad optimisation)
- The build/refresh sequence once defined
- Stage gates: what must be true before the next stage starts

## What does not belong here

- Executable code
- SQL — that belongs in `sql/` or `query-packs/`
- One-off instructions given in a single session — those belong in `prompts/`
