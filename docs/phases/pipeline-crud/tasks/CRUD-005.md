# CRUD-005 — Pipeline Repository Delete Operation

**Status:** COMPLETE
**Owner:** pipeline_delete
**Depends on:** CRUD-002

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [x] Owner-scope deletion.
- [x] Reject queued/running deletion.
- [x] Use intentional cascade behavior for components/edges/triggers.
- [x] Preserve historical runs where architecture intends.
- [x] Add database integration tests.

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

- Retained runs prevent deletion through the existing restrictive foreign key; components, edges, and triggers cascade only when no run history exists.
- PostgreSQL integration coverage verifies both the cascade and retained-history paths.
