# BUILDER-007 — Reuse Builder Editors for Existing Pipelines

**Status:** COMPLETE
**Owner:** Claude
**Depends on:** BUILDER-006

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [x] Edit/replace Source for idle pipeline.
- [x] Edit/add/remove/reorder Transforms.
- [x] Edit/replace Export.
- [x] Queued/running remains read-only.
- [x] PATCH remains persistence path.
- [x] No duplicate editor system.

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

The Source/Transforms/Export tabs in the existing pipeline editor now render the exact same components the wizard uses (`ComponentPickerConfiguration`, the Transforms step), reconstructing their local editing state from the pipeline via the same `createPipelineBuilderDraftFromPipeline` reconstruction used for wizard resume — no separate editor implementation was added. All three panels share the editor's single existing "Save changes" action, which now sends a graph update (steps/edges) alongside the name through the same PATCH path already used for renames. When the pipeline is not editable, or capability data has not resolved, the panels fall back to the pre-existing read-only step list rather than exposing controls that cannot safely be used; this fallback could not be covered by a static-markup unit test because the design system's Tabs primitive only mounts the active panel outside a real browser, so this behavior is covered by a browser test instead. Note: the control plane does not yet track active/queued runs when computing editability (`getPipelineExecutionState` always reports no active run), so "queued/running remains read-only" is enforced correctly by this component whenever it is told a pipeline is not editable, but that determination is not yet wired to real run state — that gap predates this task and is outside its scope.
