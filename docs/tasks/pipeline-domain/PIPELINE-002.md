# PIPELINE-002 — Pipeline State Machine

**Status:** BLOCKED  
**Owner:** Unassigned  
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

- [ ] Invalid transitions fail.
- [ ] Rules covered by tests.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

None.
