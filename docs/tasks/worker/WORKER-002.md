# WORKER-002 — PostgreSQL Job Claiming and Heartbeat

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Worker
**Workstream:** Worker  
**Depends on:** WORKER-001, DB-003

## Scope

Implement short transaction job claims and heartbeat.

- Eligible claim.
- Commit before execution.
- Heartbeat.
- Safe fail/release.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Multiple workers claim distinct jobs.
- [x] No long claim transaction.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

Added a PostgreSQL queue boundary with atomic `SKIP LOCKED` claims, ownership-
guarded heartbeats/releases, and retry-aware failure transitions. Every operation
closes its transaction before returning a job to execution code.
