# SCHED-002 — Due-Schedule Claiming

**Status:** BLOCKED  
**Owner:** Unassigned  
**Workstream:** Scheduler  
**Depends on:** SCHED-001

## Scope

Implement safe concurrent due-schedule claiming.

- Find due schedules.
- Claim safely.
- Prevent duplicates.
- Compute next run.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [ ] Multiple instances do not duplicate scheduled runs.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

None.
