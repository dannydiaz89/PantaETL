# SOURCE-001 — CSV Source

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Sources  
**Depends on:** WORKER-003, WORKER-004

## Scope

Implement CSV Source.

- Config schema.
- Parsing.
- Dataset output.
- Safe errors.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Produces supported Dataset.
- [x] No record contents in logs.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

The local CSV Source validates root-relative input locations, parses configured
delimited files, and persists a tabular Parquet Dataset. File and parsing
errors use safe context only.
