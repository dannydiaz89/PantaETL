# WORKER-002 — PostgreSQL Job Claiming and Heartbeat

**Status:** BLOCKED  
**Owner:** Unassigned  
**Workstream:** Worker  
**Depends on:** WORKER-001, DB-003

## Scope

Implement short transaction job claims and heartbeat.

- Eligible claim.
- Commit before execution.
- Heartbeat.
- Safe fail/release.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [ ] Multiple workers claim distinct jobs.
- [ ] No long claim transaction.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

None.
