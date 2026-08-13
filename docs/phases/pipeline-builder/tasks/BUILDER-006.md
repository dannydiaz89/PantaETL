# BUILDER-006 — Draft Persistence and Resume

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** BUILDER-004, BUILDER-005, FORM-002

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [ ] Persist incomplete drafts where canonical contract allows.
- [ ] Never insert fake placeholder components.
- [ ] Use existing POST/PATCH graph payloads.
- [ ] Reload reconstructs builder state.
- [ ] Preserve write-only secret semantics.
- [ ] Successful save clears dirty state.
- [ ] Failed save keeps input.

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
