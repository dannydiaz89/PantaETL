# VALID-003 — Enforce Executable Validation on Enable

**Status:** COMPLETE
**Owner:** Claude
**Depends on:** VALID-002

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [x] Incomplete draft cannot enable.
- [x] Incompatible pipeline cannot enable.
- [x] Missing config cannot enable.
- [x] Missing required secret binding cannot enable.
- [x] Structured actionable API errors.
- [x] Frontend cannot bypass server validation.

## Required checks

- Relevant unit/integration tests.
- TypeScript typecheck/lint for TS changes.
- Ruff, mypy, pytest for Python changes.
- Contract/catalog generation consistency when applicable.
- Accessibility checks for UI changes.
- Localize all user-facing strings.
- Add useful descriptions for exported/public and non-trivial functions.
- Do not reference task IDs/planning docs in implementation comments or commit messages.

## Notes / blockers

`enablePipelineForOwner` now reads the pipeline's persisted graph inside the same transaction as the state check and runs `assertPipelineExecutable` (VALID-002) against the deployment's real component catalog before writing the new state, so a rejected enable never leaves the pipeline half-transitioned. `disablePipelineForOwner` is unchanged and never runs this check. A new `PipelineActionConflictReason` ("not_executable") carries the full violation list through to the HTTP boundary as `{ code: "pipeline_not_executable", violations: [...] }` with a 409, giving callers structured detail without this task designing a per-violation UI; the frontend message stays generic ("configuration is incomplete or invalid, review the steps and try again"). This is enforced entirely server-side in the database layer, so no frontend code path can bypass it.
