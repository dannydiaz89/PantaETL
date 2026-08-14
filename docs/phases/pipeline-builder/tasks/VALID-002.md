# VALID-002 — Separate Draft Validation From Executable Validation

**Status:** COMPLETE
**Owner:** Claude
**Depends on:** BUILDER-005

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [x] Draft validation permits supported incomplete states.
- [x] Executable requires one Source and one Export.
- [x] Executable checks connected linear chain.
- [x] Verify component availability.
- [x] Verify required config/secret bindings.
- [x] Verify adjacent family compatibility.
- [x] Validation is UI/persistence independent.

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

`checkPipelineExecutable`/`assertPipelineExecutable` in `@pantaetl/pipeline` are a second, independent validation pass a caller runs only when deciding whether a pipeline may be enabled; the existing create/update contract schemas are untouched and continue to permit an incomplete graph. The check collects every violation in one pass (missing/duplicate Source or Export, a branching or disconnected step, an unavailable component, a missing required config value or secret binding reference, an incompatible adjacent pair) rather than stopping at the first, reusing `buildPipelineTopology` and `checkComponentCompatibility` instead of reimplementing graph or family logic. It only checks that a required secret has a binding *reference*, never inspecting binding contents. Not yet wired into the enable API route — that is VALID-003's job.
