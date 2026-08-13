# TRANSFORM-001 — Column Transform Set

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Transforms  
**Depends on:** WORKER-003, WORKER-004

## Scope

Implement initial column transforms.

- Select.
- Rename.
- Drop.
- Reorder where useful.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Focused modules.
- [x] Documented config models.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

Focused select, rename, drop, and reorder Transform modules use validated
configuration models and persist each tabular result through Dataset storage.
