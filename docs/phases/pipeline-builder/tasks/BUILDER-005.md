# BUILDER-005 — Deterministic Linear Graph Derivation

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** BUILDER-002

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [ ] Generate adjacent edges deterministically.
- [ ] Source connects to first Transform or Export.
- [ ] Transforms connect in displayed order.
- [ ] Last Transform connects to Export.
- [ ] Removal/reorder updates edges.
- [ ] Preserve step IDs.
- [ ] Tests cover 0/1/multiple transforms.

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
