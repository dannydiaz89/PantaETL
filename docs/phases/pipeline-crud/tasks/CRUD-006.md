# CRUD-006 — Pipeline Duplication Operation

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** CRUD-003, CRUD-004

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [ ] Generate new pipeline identity.
- [ ] Keep graph internally consistent.
- [ ] Copy non-secret configuration.
- [ ] Do not copy usable credentials.
- [ ] Assign copy to requesting user.
- [ ] Start draft/disabled.
- [ ] Reset schedule runtime metadata.

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
