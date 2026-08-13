# PIPELINE-004 — Duplication and Import/Export Rules

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Pipeline Domain
**Workstream:** Pipeline Domain  
**Depends on:** PIPELINE-002, PIPELINE-003

## Scope

Implement portable pipeline definition rules.

- Duplicate non-secret config.
- Strip usable credentials.
- Imported pipeline disabled/draft.
- Reject unavailable capabilities.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Rules are testable without web UI.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

Added pure portable-definition helpers. Exports and duplicates retain graph
structure and non-secret configuration while clearing credential bindings;
imports require available component capabilities and always enter draft state.
