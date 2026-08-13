# BUILDER-004 — Export Selection and Configuration Step

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** BUILDER-003

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [ ] Choose one Export.
- [ ] Metadata-driven form.
- [ ] Changing Export clears stale config safely.
- [ ] Stable PipelineStep draft ID.
- [ ] Final action communicates draft/readiness.
- [ ] No CSV Export assumption.

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
