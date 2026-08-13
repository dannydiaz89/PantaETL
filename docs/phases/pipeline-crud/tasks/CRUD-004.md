# CRUD-004 — Pipeline Repository Update Operation

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** CRUD-002, CRUD-003

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [ ] Reject queued/running updates.
- [ ] Update idle pipeline atomically.
- [ ] Support name/state/components/edges/triggers.
- [ ] Preserve existing secret bindings unless explicitly replaced.
- [ ] Use shared topology/compatibility/domain logic.
- [ ] Update updatedAt.
- [ ] Rollback on partial failure.

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
