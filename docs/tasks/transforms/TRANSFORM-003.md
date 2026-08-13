# TRANSFORM-003 — Value and Type Transform Set

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Transforms  
**Depends on:** WORKER-003, WORKER-004

## Scope

Implement value/type transforms.

- Cast.
- Replace.
- Fill null.
- String normalization.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] No network/secrets.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

Cast, replace, fill-null, and string normalization transforms operate only on
temporary Datasets through the storage boundary; they receive neither secrets
nor network clients.
