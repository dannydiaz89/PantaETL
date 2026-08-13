# EXPORT-004 — PostgreSQL Export

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Exports  
**Depends on:** WORKER-004, DB-005

## Scope

Implement PostgreSQL Export.

- Connection config.
- Write mode.
- Transactional/idempotent retry semantics.
- Safe errors.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Partial failure has explicit safe retry behavior.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

The PostgreSQL Export stages each run inside a transaction: replacement is
atomic, and append requires a target uniqueness constraint for idempotent retry.
Errors omit connection and record contents.
