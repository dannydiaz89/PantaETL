# CONTRACT-007 — JSON Schema Generation

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Contracts  
**Depends on:** CONTRACT-003, CONTRACT-004, CONTRACT-005, CONTRACT-006

## Scope

Generate deterministic JSON Schema from cross-service Zod contracts.

- Generation script.
- Generated schema directory.
- Staleness/consistency check.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Generation is deterministic.
- [x] Generated files are not hand-maintained.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

- `pnpm --filter @pantaetl/contracts generate:schemas`
- `pnpm --filter @pantaetl/contracts check`
- `pnpm check`
- Frozen lockfile installation

## Notes / blockers

Added deterministic JSON Schema generation for component metadata, Dataset, Artifact,
job, run, and pipeline contracts. Contract checks regenerate schemas and fail when
generated files are changed or missing from version control. Two consecutive generation
runs produced identical SHA-256 checksums for every generated schema.
