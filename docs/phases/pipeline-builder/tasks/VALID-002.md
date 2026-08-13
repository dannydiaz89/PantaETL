# VALID-002 — Separate Draft Validation From Executable Validation

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** BUILDER-005

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [ ] Draft validation permits supported incomplete states.
- [ ] Executable requires one Source and one Export.
- [ ] Executable checks connected linear chain.
- [ ] Verify component availability.
- [ ] Verify required config/secret bindings.
- [ ] Verify adjacent family compatibility.
- [ ] Validation is UI/persistence independent.

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
