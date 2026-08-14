# CLEAN-001 — Remove Obsolete CSV-Specific Creation and Pipeline Fixtures

**Status:** COMPLETE
**Owner:** Claude
**Depends on:** E2E-002

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [x] Remove CSV-specific create assumptions.
- [x] Remove obsolete pipeline fixtures/IDs/mappings.
- [x] Remove dead translations/imports safely.
- [x] Keep CRUD E2E green.
- [x] Do not remove unrelated reusable test fixtures.

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

Removed the standalone CSV-only quick-create dialog and its draft fixture, now that the
wizard is the sole, fully general creation path. The pipeline library's "Create pipeline"
control is a real navigation link to the wizard instead of opening a dialog. The pipeline
lifecycle browser test also uncovered that a worker attached to this deployment can claim
and finish a trivial run before a UI check reaches the server; the affected assertions now
retry with a fresh run rather than assume one just queued is still active moments later.
