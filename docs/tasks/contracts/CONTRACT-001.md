# CONTRACT-001 — Contracts Package Foundation

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Contracts  
**Depends on:** APP-005

## Scope

Turn the existing contracts package scaffold into the canonical cross-service contract package.

- Add Zod.
- Create domain folders.
- Create public exports.
- Set contract versioning conventions.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Package builds/tests independently.
- [x] No DB/UI implementation leaks in.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

- `pnpm --filter @pantaetl/contracts check`
- `pnpm check`
- Direct runtime validation of root and `./common` package exports

## Notes / blockers

Added Zod-backed contract version primitives, explicit public subpath exports, and
the common/pipeline/execution/dataset/components/api domain boundaries. The package
includes focused runtime tests for version acceptance and rejection without adding
database or UI implementation.
