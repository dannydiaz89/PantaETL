# INT-CRUD-002 — Pipeline UI End-to-End Tests

**Status:** BLOCKED
**Owner:** pipeline_ui_e2e
**Depends on:** UI-WIRE-004, UI-WIRE-005, UI-WIRE-006

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [ ] Create pipeline via UI.
- [ ] Configure available source/transform/export/trigger.
- [ ] Save/reload and verify persistence.
- [ ] Enable pipeline.
- [ ] Exercise Run Now according to test execution setup.
- [ ] Verify edit lock behavior.
- [ ] Duplicate pipeline.
- [ ] Delete idle pipeline.
- [ ] No mocked pipeline fixture required.

## Required checks

- relevant unit/integration tests
- TypeScript type checking
- linting
- migration checks if database schema changes
- accessibility checks for UI work
- useful descriptions for exported/non-trivial functions
- no roadmap/task references in implementation comments or commit messages

## Notes / blockers

The pipeline workspace can create a fixed CSV source-to-export draft and update a pipeline name, but it does not yet expose component, edge, or trigger editing. The API already accepts graph updates; this task requires that UI configuration capability before a real end-to-end flow can configure the required source, transform, export, and trigger without mocks or direct API calls.
