# EXPORT-003 — Parquet Artifact Export

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Exports  
**Depends on:** WORKER-003, WORKER-004, DB-004

## Scope

Implement Parquet artifact Export.

- Artifact write.
- Retention.
- Streaming/lazy sink.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Large output need not fit fully in RAM.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

The Parquet Export streams unencrypted local Parquet inputs through Polars'
lazy sink into an atomically published artifact with retained metadata.
