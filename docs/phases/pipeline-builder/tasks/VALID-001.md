# VALID-001 — Compatibility-Aware Component Selection

**Status:** COMPLETE
**Owner:** Claude
**Depends on:** CAP-004, BUILDER-003

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [x] Transform choices reflect upstream compatibility.
- [x] Export choices reflect final upstream compatibility.
- [x] Incompatible options hidden or disabled with reason.
- [x] Upstream changes re-evaluate downstream.
- [x] Backend remains authoritative.
- [x] Reuse shared compatibility utilities.

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

The Transforms "add" picker and the Export picker are both disabled per-option (not hidden) against the current chain's last component, reusing `checkComponentCompatibility` from `@pantaetl/pipeline` rather than reimplementing family matching. Nothing is disabled until an upstream component exists to check against. Because the resolver is recomputed from live draft state on every render, changing the Source or the Transform list automatically re-evaluates the Export picker's options without any extra wiring. The domain layer's own `reason` string is not surfaced directly (it is plain English with no localization, meant more as a developer-facing default); a single localized reason is used instead, since the only failure mode reachable through these two pickers is "no shared data family" — the picker itself already disables selection entirely, so this remains presentational only, and the backend (VALID-002/VALID-003) is still authoritative for what can actually be saved or enabled.
