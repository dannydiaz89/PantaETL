# BUILDER-001 — Three-Step Wizard Shell and Local Draft Model

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** FORM-003

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [ ] Exactly three numbered stages: Source, Transforms, Export.
- [ ] Pipeline name collected without a fourth stage.
- [ ] Back/Next preserves draft.
- [ ] Progress state accessible and not color-only.
- [ ] Use application shell.
- [ ] Local draft is not a new persistence/domain model.

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
