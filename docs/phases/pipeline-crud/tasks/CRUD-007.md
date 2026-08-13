# CRUD-007 — Pipeline Run and State Action Service

**Status:** COMPLETE
**Owner:** pipeline_actions
**Depends on:** CRUD-002

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [x] Run rejects non-enabled pipelines.
- [x] Run uses existing execution enqueue infrastructure.
- [x] Enable/disable uses shared domain state rules.
- [x] Reject locked invalid transitions.
- [x] Owner-scope all actions.
- [x] Map domain conflicts cleanly for API layer.

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

- Uses the scheduler's existing durable run queue and exposes stable, safe conflict reasons for route mapping.
- Owner-scoped state actions use the shared pipeline-domain edit lock before persisting availability changes.
