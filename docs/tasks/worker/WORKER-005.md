# WORKER-005 — Cancellation and Terminal Cleanup Signaling

**Status:** BLOCKED  
**Owner:** Unassigned  
**Workstream:** Worker  
**Depends on:** WORKER-002, WORKER-003

## Scope

Implement cooperative cancellation and cleanup eligibility.

- Observe cancellation.
- Stop pending work.
- Terminal state.
- Mark datasets cleanup-eligible.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [ ] Cancelled work does not continue invisibly.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

None.
