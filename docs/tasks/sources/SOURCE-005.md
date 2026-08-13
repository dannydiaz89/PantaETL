# SOURCE-005 — PostgreSQL Source

**Status:** COMPLETE
**Owner:** Codex
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

- [x] Does not require whole source in RAM.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

The PostgreSQL Source resolves an assigned secret binding, executes only a
single read-only table/query acquisition, and streams cursor batches into
temporary Parquet storage without holding the whole source in memory.
