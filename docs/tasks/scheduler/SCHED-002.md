# SCHED-002 — Due-Schedule Claiming

**Status:** COMPLETE
**Owner:** Codex
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

- [x] Multiple instances do not duplicate scheduled runs.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

Due schedule occurrences are claimed with short PostgreSQL row locks, advance from their prior occurrence to preserve missed runs, and exclude disabled pipelines.
