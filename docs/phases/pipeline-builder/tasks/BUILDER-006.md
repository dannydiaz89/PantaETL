# BUILDER-006 — Draft Persistence and Resume

**Status:** COMPLETE
**Owner:** Claude
**Depends on:** BUILDER-004, BUILDER-005, FORM-002

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [x] Persist incomplete drafts where canonical contract allows.
- [x] Never insert fake placeholder components.
- [x] Use existing POST/PATCH graph payloads.
- [x] Reload reconstructs builder state.
- [x] Preserve write-only secret semantics.
- [x] Successful save clears dirty state.
- [x] Failed save keeps input.

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

A draft becomes savable once the canonical contract can accept it (a non-empty name and at least one component), independent of the separate readiness status BUILDER-004 added for a complete Source+Export pair; the first save creates the pipeline, later saves send a graph-only PATCH that never touches triggers or state. Resume works by remembering the saved pipeline's id in browser storage and, on load, reconstructing wizard state by walking the persisted graph's edges (not raw step array order) and resolving each step's component through the same capability catalog the wizard already uses; if any step's component cannot be resolved, reconstruction is refused entirely rather than silently dropping or fabricating a step. Secret bindings round-trip as opaque references only, matching the write-only limitation already recorded in BUILDER-002/003/004 — no secret-write backend exists yet.
