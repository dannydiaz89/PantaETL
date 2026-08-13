# WORKER-006 — Checkpoint Execution Lifecycle

**Status:** BLOCKED  
**Owner:** Unassigned  
**Workstream:** Worker  
**Depends on:** WORKER-002, DB-004, CONTRACT-005

## Scope

Implement checkpoint read/candidate/commit lifecycle.

- Load checkpoint.
- Allow Source-specific candidate.
- Commit only after full success.
- Do not advance on failure.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [ ] Failed pipeline does not advance checkpoint.
- [ ] Concurrent same-pipeline checkpoint update cannot occur.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

None.
