# INT-CRUD-003 — Remove Obsolete Pipeline Fixtures

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** INT-CRUD-002

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [ ] Remove createPipelineFixtures().
- [ ] Remove fixture-only IDs.
- [ ] Remove fixture-only mapping/helpers.
- [ ] Remove dead translations/imports.
- [ ] Run full affected tests.

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
