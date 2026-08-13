# CONTRACT-007 — JSON Schema Generation

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Contracts  
**Depends on:** CONTRACT-003, CONTRACT-004, CONTRACT-005, CONTRACT-006

## Scope

Establish deterministic, canonical JSON Schema documents for cross-service
contracts and generate TypeScript artifacts from them.

- Canonical schema directory.
- TypeScript declaration generation script.
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

- `pnpm --filter @pantaetl/contracts generate:types`
- `pnpm --filter @pantaetl/contracts check`
- `pnpm check`
- Frozen lockfile installation

## Notes / blockers

Canonical JSON Schema documents now define component metadata, Dataset, Artifact,
job, run, pipeline, and Source execution request contracts. TypeScript declarations
and Zod boundary validators are derived from those documents. Contract checks
regenerate declarations and fail when generated files are changed or missing from
version control.
