# CLEAN-001 — Remove Obsolete CSV-Specific Creation and Pipeline Fixtures

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** E2E-002

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [ ] Remove CSV-specific create assumptions.
- [ ] Remove obsolete pipeline fixtures/IDs/mappings.
- [ ] Remove dead translations/imports safely.
- [ ] Keep CRUD E2E green.
- [ ] Do not remove unrelated reusable test fixtures.

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

None.
