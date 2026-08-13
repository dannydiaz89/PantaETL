# UI-WIRE-004 — Wire Pipeline Create Update Delete

**Status:** COMPLETE
**Owner:** ui_pipeline_mutations
**Depends on:** UI-WIRE-003

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [x] Create pipeline through API.
- [x] Edit idle pipeline through API.
- [x] Surface backend 409 lock accessibly.
- [x] Delete idle pipeline with confirmation.
- [x] Update cache/state after mutations.
- [x] Never prefill secrets from API.

## Required checks

- relevant unit/integration tests
- TypeScript type checking
- linting
- migration checks if database schema changes
- accessibility checks for UI work
- useful descriptions for exported/non-trivial functions
- no roadmap/task references in implementation comments or commit messages

## Notes / blockers

Creation uses a non-secret starter pipeline; editor drafts remain local until an API mutation succeeds.
