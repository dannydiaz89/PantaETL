# BUILDER-003 — Transform Add Configure Remove Reorder Step

**Status:** COMPLETE
**Owner:** Claude
**Depends on:** BUILDER-002

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [x] Zero transforms allowed.
- [x] Add multiple transforms.
- [x] Configure via metadata.
- [x] Remove transforms.
- [x] Reorder without recreating stable IDs.
- [x] Clearly show order.
- [x] Keyboard reorder available.

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

Reordering uses explicit Move up/Move down buttons per Transform rather than drag-and-drop, so keyboard reorder is the only control surface (matching the spec's requirement that keyboard controls exist regardless of whether drag-and-drop is added later). Changing an existing Transform's component type is not supported from the wizard; removing and re-adding covers that case, keeping the step's interaction model simple. Secret-bound Transform fields have the same limitation noted in BUILDER-002: no secret-write backend exists yet.
