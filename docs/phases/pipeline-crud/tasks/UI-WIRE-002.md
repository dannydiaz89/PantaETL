# UI-WIRE-002 — Pipeline Workspace Decomposition

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** CRUD-001

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [ ] Split current large workspace by meaningful responsibility.
- [ ] Preserve visible behavior.
- [ ] Preserve design system/localization/accessibility.
- [ ] Do not add direct Radix imports.
- [ ] Do not hardcode user-facing English.
- [ ] Existing tests continue to pass.

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
