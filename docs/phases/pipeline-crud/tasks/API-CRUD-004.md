# API-CRUD-004 — Pipeline OpenAPI Coverage

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** API-CRUD-001, API-CRUD-002, API-CRUD-003

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [ ] Add all pipeline endpoints to OpenAPI.
- [ ] Keep schemas aligned with runtime contracts.
- [ ] Document auth and 400/401/404/409 behavior.
- [ ] Do not maintain duplicate handwritten schemas.

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
