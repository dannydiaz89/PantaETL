# PIPELINE-003 — Component Compatibility Rules

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Pipeline Domain
**Workstream:** Pipeline Domain  
**Depends on:** PIPELINE-001, CONTRACT-004

## Scope

Implement broad dataset-family compatibility checks across components.

- any/document/tabular/file.
- Transform-owned conversions.
- Export compatibility.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Known incompatibility fails before execution.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

Added metadata-driven dataset-family compatibility checks. Source and Export
remain at the ends of the data chain, and Transform conversions must be declared
through their distinct input and output families.
