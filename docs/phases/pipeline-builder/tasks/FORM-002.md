# FORM-002 — Write-Only Secret Field and Binding UX

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** FORM-001

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [ ] Never request/display stored plaintext.
- [ ] Indicate configured state safely.
- [ ] Untouched secret preserves binding.
- [ ] Replacement uses write-only secret mechanism.
- [ ] Secret errors accessible.
- [ ] Secret values never enter configuration.values.

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
