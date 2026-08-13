# PIPELINE-002 — Pipeline State Machine

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Pipeline Domain
**Workstream:** Pipeline Domain  
**Depends on:** PIPELINE-001

## Scope

Implement enabled/disabled/editable/active rules and same-pipeline serialization.

- Editing lock while active.
- One active run per pipeline.
- Queued subsequent runs.
- Cancellation transitions.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Invalid transitions fail.
- [x] Rules covered by tests.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

Added a pure FIFO pipeline execution state machine. It locks configuration while
work is queued or running, serializes same-pipeline runs, and records
cancellation requests until a terminal result releases the execution lock.
