# UI-WIRE-001 — Pipeline Query and Mutation Layer

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** API-CRUD-001, API-CRUD-002

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [ ] Centralize pipeline query keys.
- [ ] Implement list/detail queries.
- [ ] Implement create/update/delete mutations.
- [ ] Validate responses at API boundary.
- [ ] Use structured API errors.
- [ ] Invalidate/update caches correctly.

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
