# FORM-001 — Generic Component Configuration Renderer

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** CAP-002

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [ ] Support all current metadata field types.
- [ ] Accessible required labels/errors.
- [ ] Use translation keys.
- [ ] Use metadata select options.
- [ ] Safe JSON validation.
- [ ] Output non-secret values only.
- [ ] No component-type-specific if-chain.

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
