# CONTRACT-002 — Core Identifier Contracts

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Contracts  
**Depends on:** CONTRACT-001

## Scope

Define stable identifiers/shared primitives.

- Pipeline/run/job/dataset/artifact/user/component/checkpoint IDs.
- Timestamp/version primitives.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Runtime validation tests exist.
- [x] Consumers can import canonical IDs.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

- `pnpm --filter @pantaetl/contracts check`
- `pnpm check`
- Frozen lockfile installation

## Notes / blockers

Added branded UUID schemas for pipeline, run, job, dataset, artifact, user,
component, and checkpoint identifiers, plus shared timestamp and major-version
primitives. Canonical schemas and types are exported from the package root and
common subpath.
