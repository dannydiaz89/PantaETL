# UI-WIRE-005 — Wire Duplicate Run Enable Disable

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** API-CRUD-003, UI-WIRE-003

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [ ] Duplicate creates new draft/disabled pipeline.
- [ ] Run Now uses real endpoint.
- [ ] Enable/disable reflects server state.
- [ ] Surface conflict errors without losing user edits.
- [ ] Use localized action text.

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
