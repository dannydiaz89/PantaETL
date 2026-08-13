# API-CRUD-001 — Pipeline List and Create Routes

**Status:** COMPLETE
**Owner:** api_pipeline_collection
**Depends on:** CRUD-002, CRUD-003

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [x] Add GET /api/pipelines.
- [x] Add POST /api/pipelines.
- [x] Require authentication.
- [x] GET returns only authorized pipelines.
- [x] POST does not trust caller-supplied owner.
- [x] POST returns 201.
- [x] Validate requests/responses with canonical contracts.
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

- Both collection handlers derive ownership solely from the authenticated session and validate canonical request and response contracts.
