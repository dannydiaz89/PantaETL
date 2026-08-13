# CRUD-002 — Pipeline Repository Read Operations

**Status:** COMPLETE
**Owner:** pipeline_reads
**Depends on:** CRUD-001

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [x] List pipelines by owner.
- [x] Fetch one pipeline by owner + ID.
- [x] Hydrate components, edges, and triggers into canonical Pipeline.
- [x] Validate hydrated object with canonical Pipeline schema.
- [x] Never return plaintext secrets.
- [x] Centralize hydration/mapping logic.

## Required checks

- relevant unit/integration tests
- TypeScript type checking
- linting
- migration checks if database schema changes
- accessibility checks for UI work
- useful descriptions for exported/non-trivial functions
- no roadmap/task references in implementation comments or commit messages

## Notes / blockers

None.

## Implementation notes

- Added a single canonical-contract hydration boundary for owner-scoped pipeline graphs.
- Added repository reads and focused tests for empty, detail, list, and secret-safe responses.
