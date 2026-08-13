# INT-CRUD-001 — Pipeline CRUD Integration Tests

**Status:** COMPLETE
**Owner:** pipeline_crud_integration
**Depends on:** API-CRUD-004

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [x] Test create-read-update-delete round trip.
- [x] Verify components/edges/triggers persistence.
- [x] Test owner isolation.
- [x] Test locked update/delete conflict.
- [x] Test duplicate secret-clearing.
- [x] Test run invalid-state behavior.
- [x] Verify failed transaction leaves no partial graph.

## Required checks

- relevant unit/integration tests
- TypeScript type checking
- linting
- migration checks if database schema changes
- accessibility checks for UI work
- useful descriptions for exported/non-trivial functions
- no roadmap/task references in implementation comments or commit messages

## Notes / blockers

The suite runs against PostgreSQL only when `DATABASE_URL` is supplied and removes its isolated owner fixtures after every case.
