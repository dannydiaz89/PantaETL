# CONTRACT-004 — Dataset and Artifact Contracts

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Contracts  
**Depends on:** CONTRACT-002

## Scope

Define Dataset descriptors and retained Artifact metadata.

- Dataset families.
- Storage descriptor.
- Optional inferred/declared structure metadata.
- Artifact retention metadata.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Does not assume all data is tabular.
- [x] Representative validation tests exist.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

- `pnpm --filter @pantaetl/contracts check`
- `pnpm check`
- Frozen lockfile installation

## Notes / blockers

Added versioned Dataset and Artifact descriptors with non-tabular data families,
credential-free storage descriptors, optional structure metadata, execution ownership,
dataset expiry, and explicit artifact retention metadata. Representative document and
file datasets plus retained artifact metadata are runtime-tested.
