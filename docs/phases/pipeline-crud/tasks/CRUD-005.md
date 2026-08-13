# CRUD-005 — Pipeline Repository Delete Operation

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** CRUD-002

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [ ] Owner-scope deletion.
- [ ] Reject queued/running deletion.
- [ ] Use intentional cascade behavior for components/edges/triggers.
- [ ] Preserve historical runs where architecture intends.
- [ ] Add database integration tests.

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
