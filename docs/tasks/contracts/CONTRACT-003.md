# CONTRACT-003 — Component Configuration Contracts

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Contracts  
**Depends on:** CONTRACT-002

## Scope

Define Source/Transform/Export component metadata and configuration schema conventions.

- Component kind/type/version.
- Display/description translation keys.
- Config field metadata.
- Secret-field marker.
- Input/output family metadata.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Supports UI form generation needs without owning UI.
- [x] Secret fields are identifiable.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

- `pnpm --filter @pantaetl/contracts check`
- `pnpm check`
- Frozen lockfile installation

## Notes / blockers

Added Zod metadata schemas for component kind/type/version, localization keys,
configuration fields/options, secret markers, and broad input/output data families.
The schemas remain UI-agnostic and expose only metadata needed by a form renderer.
