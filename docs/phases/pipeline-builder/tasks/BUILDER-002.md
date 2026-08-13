# BUILDER-002 — Source Selection and Configuration Step

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** BUILDER-001

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [ ] Choose one available Source.
- [ ] Render metadata-driven form.
- [ ] Changing Source clears stale incompatible config.
- [ ] Maintain stable PipelineStep draft ID.
- [ ] Expose output family for compatibility.
- [ ] No CSV assumption.

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
