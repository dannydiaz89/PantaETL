# CRUD-003 — Pipeline Repository Create Operation

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** CRUD-001

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [ ] Create pipeline/components/edges/triggers atomically.
- [ ] Assign owner from trusted authenticated context.
- [ ] Validate topology/configuration before commit.
- [ ] Do not persist secrets as ordinary configuration JSON.
- [ ] Return canonical validated Pipeline.
- [ ] Rollback fully on failure.

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
