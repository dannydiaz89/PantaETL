# EXPORT-004 — PostgreSQL Export

**Status:** BLOCKED  
**Owner:** Unassigned  
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

- [ ] Partial failure has explicit safe retry behavior.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

None.
