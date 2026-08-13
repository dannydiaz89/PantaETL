# CRUD-002 — Pipeline Repository Read Operations

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** CRUD-001

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [ ] List pipelines by owner.
- [ ] Fetch one pipeline by owner + ID.
- [ ] Hydrate components, edges, and triggers into canonical Pipeline.
- [ ] Validate hydrated object with canonical Pipeline schema.
- [ ] Never return plaintext secrets.
- [ ] Centralize hydration/mapping logic.

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
