# VALID-003 — Enforce Executable Validation on Enable

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** VALID-002

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [ ] Incomplete draft cannot enable.
- [ ] Incompatible pipeline cannot enable.
- [ ] Missing config cannot enable.
- [ ] Missing required secret binding cannot enable.
- [ ] Structured actionable API errors.
- [ ] Frontend cannot bypass server validation.

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
