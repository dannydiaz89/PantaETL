# UI-WIRE-001 — Pipeline Query and Mutation Layer

**Status:** COMPLETE
**Owner:** web_pipeline_data
**Depends on:** API-CRUD-001, API-CRUD-002

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [x] Centralize pipeline query keys.
- [x] Implement list/detail queries.
- [x] Implement create/update/delete mutations.
- [x] Validate responses at API boundary.
- [x] Use structured API errors.
- [x] Invalidate/update caches correctly.

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

- Provides a canonical-contract-validated client, centralized query keys, and cache reconciliation for collection and detail data.
- Safe API errors are categorized without retaining response diagnostics in browser state.
