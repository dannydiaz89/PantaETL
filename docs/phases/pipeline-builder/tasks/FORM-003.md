# FORM-003 — Component Picker Foundation

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** CAP-004, FORM-001

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [ ] Display localized name/description.
- [ ] Filter by component kind.
- [ ] Keyboard-usable search/filter.
- [ ] Selection feeds generic configuration renderer.
- [ ] Can represent disabled incompatible options with reason.
- [ ] Match selected utility-style direction.

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
