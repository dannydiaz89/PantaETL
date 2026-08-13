# CRUD-007 — Pipeline Run and State Action Service

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** CRUD-002

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [ ] Run rejects non-enabled pipelines.
- [ ] Run uses existing execution enqueue infrastructure.
- [ ] Enable/disable uses shared domain state rules.
- [ ] Reject locked invalid transitions.
- [ ] Owner-scope all actions.
- [ ] Map domain conflicts cleanly for API layer.

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
