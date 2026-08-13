# CONTRACT-008 — Pydantic Interoperability Proof

**Status:** BLOCKED  
**Owner:** Unassigned  
**Workstream:** Contracts  
**Depends on:** CONTRACT-007, APP-004

## Scope

Validate representative cross-service payloads cleanly in Python.

- Dataset.
- Job.
- Source execution request.
- Run result.
- Evaluate generated vs thin handwritten Pydantic strategy.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [ ] Valid payloads pass in TypeScript/Python.
- [ ] Invalid payloads fail consistently.
- [ ] Interoperability strategy documented.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

None.
