# BUILDER-004 — Export Selection and Configuration Step

**Status:** COMPLETE
**Owner:** Claude
**Depends on:** BUILDER-003

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [x] Choose one Export.
- [x] Metadata-driven form.
- [x] Changing Export clears stale config safely.
- [x] Stable PipelineStep draft ID.
- [x] Final action communicates draft/readiness.
- [x] No CSV Export assumption.

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

The Export step mirrors the Source step exactly, reusing the same generic picker/configuration components and the same stable-id/clear-on-change slot logic. On the final stage, Next is replaced by a localized, non-interactive readiness status (draft complete once a Source and an Export are both selected) rather than a Save action, since draft persistence is separate follow-up work. Secret-bound Export fields have the same limitation noted in BUILDER-002/BUILDER-003: no secret-write backend exists yet.
