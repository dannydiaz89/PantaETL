# BUILDER-002 — Source Selection and Configuration Step

**Status:** COMPLETE
**Owner:** Claude
**Depends on:** BUILDER-001

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [x] Choose one available Source.
- [x] Render metadata-driven form.
- [x] Changing Source clears stale incompatible config.
- [x] Maintain stable PipelineStep draft ID.
- [x] Expose output family for compatibility.
- [x] No CSV assumption.

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

The Source step reuses the existing capability picker and generic configuration renderer directly; no component-specific UI was added. Secret-bound Source fields (for example an API token) are not yet enterable: there is no secret-write backend in the codebase (only the encrypted-storage table schema exists, with no encryption implementation, repository function, contract, or API route). That is tracked as separate follow-up work, not part of this task. A Source with required secret configuration can still be selected and partially configured; its secret fields simply cannot be completed from the wizard yet.
