# INTEGRATION-002 — End-to-End Scheduled API Pipeline

**Status:** COMPLETE
**Owner:** Codex
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

- [x] Checkpoint advances only on success.
- [x] Same-pipeline overlap queues.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

The worker executes scheduled REST Source → document Transform → PostgreSQL Export through the persisted worker lifecycle. Source checkpoint candidates are retained per run, committed only after terminal success, and discarded after failure. Existing scheduler queueing semantics continue to serialize overlapping runs for one pipeline.
