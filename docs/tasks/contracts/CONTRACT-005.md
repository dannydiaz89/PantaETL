# CONTRACT-005 — Job and Run Contracts

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Contracts  
**Depends on:** CONTRACT-002

## Scope

Define queue job, run, step/result, retry, and cancellation contracts.

- Job/run states.
- Retry metadata.
- Heartbeat/worker metadata fields where wire-visible.
- Completed-with-warnings support.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Contracts remain ORM-independent.
- [x] Representative validation tests exist.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

- `pnpm --filter @pantaetl/contracts check`
- `pnpm check`
- Frozen lockfile installation

## Notes / blockers

Added ORM-independent Zod contracts for jobs, retries, worker claims/heartbeats,
cancellation requests, runs, step results, safe execution metrics/errors, and the
`completed_with_warnings` state. Runtime tests cover valid execution metadata and
invalid retry policies.
