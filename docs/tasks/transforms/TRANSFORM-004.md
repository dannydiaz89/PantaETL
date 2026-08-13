# TRANSFORM-004 — Document-to-Tabular Flatten Transform

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Transforms  
**Depends on:** WORKER-003, WORKER-004

## Scope

Implement flattening transform.

- Nested objects.
- Array behavior.
- Config schema.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Output tabular.
- [x] Unsupported shapes fail clearly.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

The document flatten Transform turns supported nested JSON objects into tabular
Datasets, with explicit record paths and array behavior. Unsupported shapes,
paths, and conflicts fail with safe, actionable errors.
