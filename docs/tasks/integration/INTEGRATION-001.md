# INTEGRATION-001 — End-to-End File Pipeline

**Status:** COMPLETE
**Owner:** Codex
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

- [x] End-to-end flow passes.
- [x] Temporary dataset is cleaned.
- [x] Artifact remains per policy.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

The worker now executes a persisted linear CSV Source → column Transform → CSV Artifact pipeline after claiming the scheduler-created Source job. A real PostgreSQL validation confirmed succeeded run, job, and three steps; temporary Datasets were marked cleanup-eligible and removed, while the CSV artifact remained retained for the default 30-day policy.
