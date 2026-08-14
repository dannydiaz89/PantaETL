# VALID-004 — Preserve Unsaved Builder State on Lock Conflicts

**Status:** COMPLETE
**Owner:** Claude
**Depends on:** BUILDER-006

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [x] 409 does not discard local draft.
- [x] Accessible lock explanation.
- [x] Reload/retry path.
- [x] Prevent duplicate pending submissions.
- [x] Retry after lock clears without re-entering non-secret config.
- [x] Secret behavior remains safe.

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

Most of this was already correct by construction from BUILDER-006 (the draft is never touched on a failed save, the existing `pipeline_locked` mapping already gives an accessible localized explanation, and a full browser reload already resumes correctly) and from the pre-existing pipeline editor's mutation guard (`updateInFlight` in the pipeline workspace already serializes editor saves). The one real gap was the wizard's own Save action: `onCreate`/`onUpdate` were only guarded by the `isSaving` prop, which lags a tick behind a synchronous double click. Added a `useRef` in-flight guard directly in `PipelineBuilderWizard`, checked and set synchronously before the first await, matching the same pattern already used elsewhere in this codebase. Covered by new browser tests: a locked conflict preserves entered name/source values and retries successfully once the lock clears, and three rapid Save clicks produce exactly one request.
