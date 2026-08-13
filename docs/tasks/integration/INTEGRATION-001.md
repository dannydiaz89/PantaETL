# INTEGRATION-001 — End-to-End File Pipeline

**Status:** BLOCKED  
**Owner:** Unassigned  
**Workstream:** Integration  
**Depends on:** WEB-006, SCHED-003, SOURCE-001, TRANSFORM-001, EXPORT-001, GC-002

## Scope

Prove a complete manually triggered file pipeline through the real application boundaries.

- Configure pipeline in web.
- Run through scheduler/job flow as designed.
- Process CSV.
- Apply transform.
- Create CSV artifact.
- Verify cleanup/retention.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [ ] End-to-end flow passes.
- [ ] Temporary dataset is cleaned.
- [ ] Artifact remains per policy.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

None.
