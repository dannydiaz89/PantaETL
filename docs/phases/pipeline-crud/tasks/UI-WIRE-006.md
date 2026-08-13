# UI-WIRE-006 — Pipeline Loading Error Empty Accessibility States

**Status:** COMPLETE
**Owner:** ui_pipeline_states
**Depends on:** UI-WIRE-003

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [x] Accessible initial loading state.
- [x] Useful empty state/create action.
- [x] Retryable error state where appropriate.
- [x] Prevent duplicate writes while mutation pending.
- [x] Preserve keyboard/focus/reduced-motion behavior.
- [x] Add representative accessibility tests.

## Required checks

- relevant unit/integration tests
- TypeScript type checking
- linting
- migration checks if database schema changes
- accessibility checks for UI work
- useful descriptions for exported/non-trivial functions
- no roadmap/task references in implementation comments or commit messages

## Notes / blockers

Pipeline query failures now present the explicit retry state immediately, and browser coverage exercises loading, empty, error, retry, and mutation-pending states.
