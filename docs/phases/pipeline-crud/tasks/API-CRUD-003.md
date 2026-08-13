# API-CRUD-003 — Pipeline Action Routes

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** CRUD-006, CRUD-007

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [ ] Add POST duplicate.
- [ ] Add POST run.
- [ ] Add POST enable.
- [ ] Add POST disable.
- [ ] Keep route domain logic thin.
- [ ] Use structured conflict errors.
- [ ] Add success/invalid-state tests.

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
