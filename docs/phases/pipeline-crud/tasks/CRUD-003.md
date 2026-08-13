# CRUD-003 — Pipeline Repository Create Operation

**Status:** COMPLETE
**Owner:** pipeline_create
**Depends on:** CRUD-001

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [x] Create pipeline/components/edges/triggers atomically.
- [x] Assign owner from trusted authenticated context.
- [x] Validate topology/configuration before commit.
- [x] Do not persist secrets as ordinary configuration JSON.
- [x] Return canonical validated Pipeline.
- [x] Rollback fully on failure.

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

- Validates the graph and canonical request before opening a database transaction.
- Persists each graph table atomically, separating configuration values from secret-binding references.
