# BUILDER-001 — Three-Step Wizard Shell and Local Draft Model

**Status:** COMPLETE
**Owner:** Claude
**Depends on:** FORM-003

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [x] Exactly three numbered stages: Source, Transforms, Export.
- [x] Pipeline name collected without a fourth stage.
- [x] Back/Next preserves draft.
- [x] Progress state accessible and not color-only.
- [x] Use application shell.
- [x] Local draft is not a new persistence/domain model.

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

The wizard shell lives at the `/pipelines/new` route (file named `pipelines_.new.tsx` so it does not nest under the existing `/pipelines` list page, which has no outlet). It is not yet linked from navigation or from the pipeline list's "Create pipeline" action; the CSV-specific dialog remains the live entry point until the Source/Transforms/Export step content and draft persistence exist. Each stage currently renders a placeholder description; component selection/configuration is wired in by later tasks against the same draft model.
