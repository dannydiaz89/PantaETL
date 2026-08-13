# WORKER-003 — Dataset Storage Abstraction

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Worker
**Workstream:** Worker  
**Depends on:** WORKER-001, CONTRACT-004

## Scope

Implement local internal Dataset storage abstraction.

- Dataset descriptors.
- Local adapter.
- Parquet locations.
- Lifecycle integration.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Can persist/read datasets.
- [x] Pipeline logic storage-independent.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

Added a Dataset storage protocol and local Parquet implementation that returns
generated descriptors, supports optional encryption at rest, uses safe
root-relative locations, and performs idempotent expiry cleanup.
