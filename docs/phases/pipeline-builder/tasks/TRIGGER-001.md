# TRIGGER-001 — Replace Read-Only Trigger Panel With Pipeline Trigger Editor

**Status:** COMPLETE
**Owner:** Claude
**Depends on:** BUILDER-007

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [x] Trigger is not a fourth wizard stage.
- [x] Manual trigger state configurable where meaningful.
- [x] Schedule add/edit/remove.
- [x] Timezone defaults naturally.
- [x] Common schedule UI does not require raw cron.
- [x] Advanced cron optional.
- [x] No global trigger/schedule navigation.
- [x] Use canonical PATCH.

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

Lives only in the existing pipeline editor's Trigger tab, edited after creation as specified; the wizard itself never gained a fourth step. Hourly/Daily/Weekly schedules are edited with plain number/select controls that translate to and from a cron expression; any cron the friendly parser does not recognize (including one entered directly) falls back to a raw "Custom" field, so nothing is lost round-tripping an unusual schedule. A newly added schedule defaults to this browser's detected IANA timezone. The manual and schedule triggers share the editor's single existing "Save changes" action and PATCH path, alongside the name and graph — introducing a separate save mechanism just for triggers would have meant two different persistence flows on one form. That did mean every save now sends a full trigger replacement (matching how the graph is already always resent), which required fixing several existing browser tests whose mocked PATCH handlers naively echoed the write-only trigger payload back as the response without assigning it fresh ids, the same way the real API does when it persists a change.
