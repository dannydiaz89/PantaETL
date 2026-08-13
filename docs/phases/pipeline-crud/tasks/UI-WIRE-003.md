# UI-WIRE-003 — Replace Pipeline Fixtures With Real Queries

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** UI-WIRE-001, UI-WIRE-002

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [ ] Load pipeline list from API.
- [ ] Load selected pipeline from API/cache.
- [ ] Remove fixture-only locked pipeline behavior from primary path.
- [ ] Use persisted execution state for editability.
- [ ] Add loading/empty/error states.
- [ ] Keep browser contract validation.

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
