# EXPORT-002 — JSON Artifact Export

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Exports  
**Depends on:** WORKER-003, WORKER-004, DB-004

## Scope

Implement JSON artifact Export.

- Artifact write.
- Retention.
- Safe finalization.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Artifact metadata recorded.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

The JSON Export atomically finalizes a JSON artifact and records its durable
metadata only after the complete output has been published.
