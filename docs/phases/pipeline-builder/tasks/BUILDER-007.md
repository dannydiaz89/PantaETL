# BUILDER-007 — Reuse Builder Editors for Existing Pipelines

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** BUILDER-006

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [ ] Edit/replace Source for idle pipeline.
- [ ] Edit/add/remove/reorder Transforms.
- [ ] Edit/replace Export.
- [ ] Queued/running remains read-only.
- [ ] PATCH remains persistence path.
- [ ] No duplicate editor system.

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
