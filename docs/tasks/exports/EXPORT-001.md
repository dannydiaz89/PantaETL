# EXPORT-001 — CSV Artifact Export

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Exports  
**Depends on:** WORKER-003, WORKER-004, DB-004

## Scope

Implement CSV artifact Export.

- Artifact write.
- Retention metadata.
- Safe finalization.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Default 30-day retention.
- [x] No partial final file on retry.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

The CSV Export atomically publishes local artifacts, writes a durable descriptor
with the default 30-day retention, and records metadata only after finalization.
