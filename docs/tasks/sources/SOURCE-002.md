# SOURCE-002 — XLSX Source

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Sources  
**Depends on:** WORKER-003, WORKER-004

## Scope

Implement XLSX Source.

- Config schema.
- Workbook/sheet behavior.
- Dataset output.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Produces supported Dataset.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

The XLSX Source safely resolves a configured workbook and selected worksheet,
then persists its parsed content as a tabular Parquet Dataset.
