# PORTABILITY-001 — Pipeline Definition Export

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Portability  
**Depends on:** PIPELINE-004, WEB-006

## Scope

Implement pipeline definition export.

- Portable structure.
- Strip credentials.
- Required capability IDs.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] No usable secrets.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

Pipeline export validates the canonical pipeline contract, strips secret
bindings and deployment identifiers, and lists required component capabilities
for the receiving deployment.
