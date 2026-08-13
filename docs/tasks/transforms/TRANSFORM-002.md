# TRANSFORM-002 — Row Transform Set

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Transforms  
**Depends on:** WORKER-003, WORKER-004

## Scope

Implement row transforms.

- Filter.
- Deduplicate.
- Sort/limit where appropriate.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Execution characteristics declared where needed.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

Declarative filter, deduplicate, stable sort, and limit transforms are persisted
through Dataset storage. Operations that require full materialization expose
their execution characteristics.
