# VALID-001 — Compatibility-Aware Component Selection

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** CAP-004, BUILDER-003

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [ ] Transform choices reflect upstream compatibility.
- [ ] Export choices reflect final upstream compatibility.
- [ ] Incompatible options hidden or disabled with reason.
- [ ] Upstream changes re-evaluate downstream.
- [ ] Backend remains authoritative.
- [ ] Reuse shared compatibility utilities.

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
