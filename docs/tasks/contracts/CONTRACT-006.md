# CONTRACT-006 — Pipeline and Trigger Contracts

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Contracts  
**Depends on:** CONTRACT-002, CONTRACT-003

## Scope

Define portable Pipeline structure and Trigger relationship.

- Pipeline structure.
- Component sequence/graph representation.
- Trigger/schedule config.
- Enabled/disabled representation.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Trigger is distinct from Source.
- [x] Portable config excludes usable secrets.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

- `pnpm --filter @pantaetl/contracts check`
- `pnpm check`
- Frozen lockfile installation

## Notes / blockers

Added portable pipeline graph, component configuration, and pipeline-owned trigger
contracts. Source/Transform/Export remain graph steps while manual and scheduled
triggers are distinct contracts. Secret-bearing configuration values are rejected;
portable definitions use non-secret binding references instead.
