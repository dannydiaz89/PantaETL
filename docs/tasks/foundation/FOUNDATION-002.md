# FOUNDATION-002 — TypeScript Quality Baseline

**Status:** COMPLETE  
**Owner:** Codex  
**Workstream:** Foundation  
**Depends on:** FOUNDATION-001

## Scope

Establish TypeScript quality conventions used by all TypeScript packages/services.

- Strict TypeScript baseline.
- Root lint/typecheck/test scripts.
- Vitest baseline.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Typecheck runs successfully.
- [x] Vitest command succeeds on scaffold.
- [x] Scripts are reusable by CI.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

Added strict TypeScript compiler settings, ESLint flat configuration, Vitest
configuration, and root `lint`, `typecheck`, `test`, and aggregate `check` scripts.
TypeScript is pinned within the supported TypeScript-ESLint peer range.
