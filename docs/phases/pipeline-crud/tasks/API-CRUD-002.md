# API-CRUD-002 — Pipeline Detail Update Delete Routes

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** CRUD-004, CRUD-005

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [ ] Add GET /api/pipelines/:pipelineId.
- [ ] Add PATCH /api/pipelines/:pipelineId.
- [ ] Add DELETE /api/pipelines/:pipelineId.
- [ ] Enforce auth/ownership.
- [ ] Return 409 on locked write/delete.
- [ ] Do not leak unauthorized resource existence.
- [ ] Add route tests.

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
