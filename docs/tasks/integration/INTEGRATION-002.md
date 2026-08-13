# INTEGRATION-002 — End-to-End Scheduled API Pipeline

**Status:** BLOCKED  
**Owner:** Unassigned  
**Workstream:** Integration  
**Depends on:** WEB-006, SCHED-003, SOURCE-004, EXPORT-004, WORKER-006

## Scope

Prove scheduled incremental API collection and database Export.

- Schedule pipeline.
- REST Source checkpoint.
- Transform path.
- PostgreSQL Export.
- Successful checkpoint commit.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [ ] Checkpoint advances only on success.
- [ ] Same-pipeline overlap queues.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

None.
