# CRUD-004 — Pipeline Repository Update Operation

**Status:** COMPLETE
**Owner:** pipeline_update
**Depends on:** CRUD-002, CRUD-003

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [x] Reject queued/running updates.
- [x] Update idle pipeline atomically.
- [x] Support name/state/components/edges/triggers.
- [x] Preserve existing secret bindings unless explicitly replaced.
- [x] Use shared topology/compatibility/domain logic.
- [x] Update updatedAt.
- [x] Rollback on partial failure.

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

- Reuses creation's canonical graph validation and the pipeline-domain edit lock.
- Replaces only explicitly supplied graph subsets in one transaction; omitted steps retain their secret-binding references.
