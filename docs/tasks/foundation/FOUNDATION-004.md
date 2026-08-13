# FOUNDATION-004 — GitHub Actions Baseline

**Status:** BLOCKED  
**Owner:** Unassigned  
**Workstream:** Foundation  
**Depends on:** FOUNDATION-002, FOUNDATION-003

## Scope

Create independent TypeScript/Python quality jobs in GitHub Actions.

- pnpm install/checks.
- uv sync/checks.
- Caching where appropriate.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [ ] Workflow validates skeleton tooling.
- [ ] TypeScript/Python failures are independently visible.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

None.
