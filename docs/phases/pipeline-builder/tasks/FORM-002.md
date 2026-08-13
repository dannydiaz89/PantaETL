# FORM-002 — Write-Only Secret Field and Binding UX

**Status:** COMPLETE
**Owner:** Codex
**Depends on:** FORM-001

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [x] Never request/display stored plaintext.
- [x] Indicate configured state safely.
- [x] Untouched secret preserves binding.
- [x] Replacement uses write-only secret mechanism.
- [x] Secret errors accessible.
- [x] Secret values never enter configuration.values.

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

Secret replacement is an explicit write-only callback that receives the entered value only for immediate submission and returns an opaque binding reference. The generic configuration form continues to handle only non-secret values.
