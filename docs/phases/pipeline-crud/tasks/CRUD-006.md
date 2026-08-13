# CRUD-006 — Pipeline Duplication Operation

**Status:** COMPLETE
**Owner:** pipeline_duplicate
**Depends on:** CRUD-003, CRUD-004

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [x] Generate new pipeline identity.
- [x] Keep graph internally consistent.
- [x] Copy non-secret configuration.
- [x] Do not copy usable credentials.
- [x] Assign copy to requesting user.
- [x] Start draft/disabled.
- [x] Reset schedule runtime metadata.

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

- Remaps every component and edge identifier into a new owner-scoped draft pipeline.
- Uses portable sanitization to remove secret bindings and creates disabled trigger definitions without schedule runtime state.
