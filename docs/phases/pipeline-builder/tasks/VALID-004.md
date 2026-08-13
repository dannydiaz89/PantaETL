# VALID-004 — Preserve Unsaved Builder State on Lock Conflicts

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** BUILDER-006

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [ ] 409 does not discard local draft.
- [ ] Accessible lock explanation.
- [ ] Reload/retry path.
- [ ] Prevent duplicate pending submissions.
- [ ] Retry after lock clears without re-entering non-secret config.
- [ ] Secret behavior remains safe.

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
