# INT-CRUD-001 — Pipeline CRUD Integration Tests

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** API-CRUD-004

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [ ] Test create-read-update-delete round trip.
- [ ] Verify components/edges/triggers persistence.
- [ ] Test owner isolation.
- [ ] Test locked update/delete conflict.
- [ ] Test duplicate secret-clearing.
- [ ] Test run invalid-state behavior.
- [ ] Verify failed transaction leaves no partial graph.

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
