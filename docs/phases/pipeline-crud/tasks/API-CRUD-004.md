# API-CRUD-004 — Pipeline OpenAPI Coverage

**Status:** COMPLETE
**Owner:** api_pipeline_openapi
**Depends on:** API-CRUD-001, API-CRUD-002, API-CRUD-003

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [x] Add all pipeline endpoints to OpenAPI.
- [x] Keep schemas aligned with runtime contracts.
- [x] Document auth and 400/401/404/409 behavior.
- [x] Do not maintain duplicate handwritten schemas.

## Required checks

- relevant unit/integration tests
- TypeScript type checking
- linting
- migration checks if database schema changes
- accessibility checks for UI work
- useful descriptions for exported/non-trivial functions
- no roadmap/task references in implementation comments or commit messages

## Notes / blockers

All pipeline routes now use canonical contract components in the generated OpenAPI document.
