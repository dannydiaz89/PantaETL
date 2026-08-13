# UI-WIRE-002 — Pipeline Workspace Decomposition

**Status:** COMPLETE
**Owner:** web_pipeline_decomposition
**Depends on:** CRUD-001

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [x] Split current large workspace by meaningful responsibility.
- [x] Preserve visible behavior.
- [x] Preserve design system/localization/accessibility.
- [x] Do not add direct Radix imports.
- [x] Do not hardcode user-facing English.
- [x] Existing tests continue to pass.

## Required checks

- relevant unit/integration tests
- TypeScript type checking
- linting
- migration checks if database schema changes
- accessibility checks for UI work
- useful descriptions for exported/non-trivial functions
- no roadmap/task references in implementation comments or commit messages

## Notes / blockers

None.

## Implementation notes

- Extracted the fixture, list, editor, and responsibility-specific editor panels while retaining the existing composition boundary.
- Existing locale catalog, design-system primitives, and edit-lock behavior are preserved.
