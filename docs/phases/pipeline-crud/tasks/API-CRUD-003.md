# API-CRUD-003 — Pipeline Action Routes

**Status:** COMPLETE
**Owner:** api_pipeline_actions
**Depends on:** CRUD-006, CRUD-007

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [x] Add POST duplicate.
- [x] Add POST run.
- [x] Add POST enable.
- [x] Add POST disable.
- [x] Keep route domain logic thin.
- [x] Use structured conflict errors.
- [x] Add success/invalid-state tests.

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

## Implementation notes

- The run route delegates through a token-authenticated scheduler endpoint, preserving the scheduler-owned durable queue transaction.
- Route handlers retain only authentication, canonical validation, and safe conflict mapping.
