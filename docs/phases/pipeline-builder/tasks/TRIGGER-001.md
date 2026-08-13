# TRIGGER-001 — Replace Read-Only Trigger Panel With Pipeline Trigger Editor

**Status:** BLOCKED
**Owner:** Unassigned
**Depends on:** BUILDER-007

## Scope

Implement only this task. Inspect current code before adding abstractions; preserve canonical contracts, registries, CRUD API, pipeline-domain rules, security, localization, accessibility, and design-system boundaries.

## Acceptance criteria

- [ ] Trigger is not a fourth wizard stage.
- [ ] Manual trigger state configurable where meaningful.
- [ ] Schedule add/edit/remove.
- [ ] Timezone defaults naturally.
- [ ] Common schedule UI does not require raw cron.
- [ ] Advanced cron optional.
- [ ] No global trigger/schedule navigation.
- [ ] Use canonical PATCH.

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
