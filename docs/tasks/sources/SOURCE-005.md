# SOURCE-005 — PostgreSQL Source

**Status:** BLOCKED  
**Owner:** Unassigned  
**Workstream:** Sources  
**Depends on:** WORKER-004, WORKER-006

## Scope

Implement PostgreSQL Source.

- Connection config.
- Query/table config.
- Chunked/lazy extraction.
- Checkpoint hooks.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [ ] Does not require whole source in RAM.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

None.
