# EXPORT-001 — CSV Artifact Export

**Status:** BLOCKED  
**Owner:** Unassigned  
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

- [ ] Default 30-day retention.
- [ ] No partial final file on retry.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

None.
