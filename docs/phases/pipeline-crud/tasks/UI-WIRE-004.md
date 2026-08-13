# UI-WIRE-004 — Wire Pipeline Create Update Delete

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** UI-WIRE-003

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [ ] Create pipeline through API.
- [ ] Edit idle pipeline through API.
- [ ] Surface backend 409 lock accessibly.
- [ ] Delete idle pipeline with confirmation.
- [ ] Update cache/state after mutations.
- [ ] Never prefill secrets from API.

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
