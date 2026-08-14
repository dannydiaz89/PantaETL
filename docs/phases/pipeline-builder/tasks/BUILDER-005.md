# BUILDER-005 — Deterministic Linear Graph Derivation

**Status:** COMPLETE
**Owner:** Claude
**Depends on:** BUILDER-002

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [x] Generate adjacent edges deterministically.
- [x] Source connects to first Transform or Export.
- [x] Transforms connect in displayed order.
- [x] Last Transform connects to Export.
- [x] Removal/reorder updates edges.
- [x] Preserve step IDs.
- [x] Tests cover 0/1/multiple transforms.

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

Pure derivation only, in a new module (`pipeline-builder-graph.ts`) that reads the existing draft model without modifying it. `derivePipelineBuilderSteps`/`derivePipelineBuilderEdges`/`derivePipelineBuilderGraph` are pure functions of current draft state (no incremental edge bookkeeping), so they naturally stay correct across add/remove/reorder. Not yet wired into the wizard's save flow; that lands with draft persistence.
