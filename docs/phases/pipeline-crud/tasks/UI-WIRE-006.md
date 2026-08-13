# UI-WIRE-006 — Pipeline Loading Error Empty Accessibility States

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** UI-WIRE-003

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [ ] Accessible initial loading state.
- [ ] Useful empty state/create action.
- [ ] Retryable error state where appropriate.
- [ ] Prevent duplicate writes while mutation pending.
- [ ] Preserve keyboard/focus/reduced-motion behavior.
- [ ] Add representative accessibility tests.

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
