# FORM-003 — Component Picker Foundation

**Status:** COMPLETE
**Owner:** Codex
**Depends on:** CAP-004, FORM-001

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [x] Display localized name/description.
- [x] Filter by component kind.
- [x] Keyboard-usable search/filter.
- [x] Selection feeds generic configuration renderer.
- [x] Can represent disabled incompatible options with reason.
- [x] Match selected utility-style direction.

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

The picker consumes the centralized kind-aware capability query. A caller can supply future compatibility results as disabled state and a localized explanation; selected metadata is passed to the generic configuration renderer.
