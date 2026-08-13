# SCHED-003 — Run and Job Creation

**Status:** BLOCKED  
**Owner:** Unassigned  
**Workstream:** Scheduler  
**Depends on:** SCHED-002, CONTRACT-005

## Scope

Create runs/jobs and queue same-pipeline overlap.

- Atomic run creation where needed.
- Insert initial jobs.
- Preserve missed schedules.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [ ] Same pipeline serializes.
- [ ] Different pipelines can run concurrently.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

None.
