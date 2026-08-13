# API-CRUD-002 — Pipeline Detail Update Delete Routes

**Status:** COMPLETE
**Owner:** api_pipeline_detail
**Depends on:** CRUD-004, CRUD-005

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [x] Add GET /api/pipelines/:pipelineId.
- [x] Add PATCH /api/pipelines/:pipelineId.
- [x] Add DELETE /api/pipelines/:pipelineId.
- [x] Enforce auth/ownership.
- [x] Return 409 on locked write/delete.
- [x] Do not leak unauthorized resource existence.
- [x] Add route tests.

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

- Detail handlers use owner-scoped repository calls and return the same not-found response for inaccessible and absent pipelines.
- Structured repository conflicts become safe HTTP 409 responses.
