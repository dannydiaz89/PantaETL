# API-CRUD-001 — Pipeline List and Create Routes

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** CRUD-002, CRUD-003

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [ ] Add GET /api/pipelines.
- [ ] Add POST /api/pipelines.
- [ ] Require authentication.
- [ ] GET returns only authorized pipelines.
- [ ] POST does not trust caller-supplied owner.
- [ ] POST returns 201.
- [ ] Validate requests/responses with canonical contracts.
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
