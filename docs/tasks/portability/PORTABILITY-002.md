# PORTABILITY-002 — Pipeline Definition Import

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Portability  
**Depends on:** PORTABILITY-001

## Scope

Implement pipeline import.

- Validate.
- Reject missing capabilities.
- Create disabled/draft.
- Require credentials later.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Clear missing-component errors.
- [x] Cannot run until reviewed.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

Imports are validated against the canonical pipeline contract, return every
missing capability in stable order, and remain draft. Both the pipeline domain
and locked scheduler transaction reject draft or disabled execution.
