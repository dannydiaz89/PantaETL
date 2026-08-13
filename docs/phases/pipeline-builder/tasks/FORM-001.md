# FORM-001 — Generic Component Configuration Renderer

**Status:** COMPLETE
**Owner:** Codex
**Depends on:** CAP-002

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [x] Support all current metadata field types.
- [x] Accessible required labels/errors.
- [x] Use translation keys.
- [x] Use metadata select options.
- [x] Safe JSON validation.
- [x] Output non-secret values only.
- [x] No component-type-specific if-chain.

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

The renderer uses `ComponentMetadata.configFields` and shared design-system controls. It drops secret and undeclared values before notifying consumers; secret-binding controls are intentionally added separately.
