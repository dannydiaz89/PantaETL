# UI-WIRE-003 — Replace Pipeline Fixtures With Real Queries

**Status:** COMPLETE
**Owner:** web_pipeline_api_data
**Depends on:** UI-WIRE-001, UI-WIRE-002

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [x] Load pipeline list from API.
- [x] Load selected pipeline from API/cache.
- [x] Remove fixture-only locked pipeline behavior from primary path.
- [x] Use persisted execution state for editability.
- [x] Add loading/empty/error states.
- [x] Keep browser contract validation.

## Required checks

- relevant unit/integration tests
- TypeScript type checking
- linting
- migration checks if database schema changes
- accessibility checks for UI work
- useful descriptions for exported/non-trivial functions
- no roadmap/task references in implementation comments or commit messages

## Notes / blockers

The workspace now reads pipeline data through the shared, contract-validating query layer.
