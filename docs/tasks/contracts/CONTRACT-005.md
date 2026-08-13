# CONTRACT-005 — Job and Run Contracts

**Status:** BLOCKED  
**Owner:** Unassigned  
**Workstream:** Contracts  
**Depends on:** CONTRACT-002

## Scope

Define queue job, run, step/result, retry, and cancellation contracts.

- Job/run states.
- Retry metadata.
- Heartbeat/worker metadata fields where wire-visible.
- Completed-with-warnings support.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [ ] Contracts remain ORM-independent.
- [ ] Representative validation tests exist.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

None.
