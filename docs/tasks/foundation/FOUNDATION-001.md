# FOUNDATION-001 — Repository Scaffolding

**Status:** READY  
**Owner:** Unassigned  
**Workstream:** Foundation  
**Depends on:** None

## Scope

Create repository-level package manager and directory foundations.

- Create root `package.json`.
- Create `pnpm-workspace.yaml`.
- Create `.gitignore` and `.editorconfig`.
- Create root TypeScript configuration baseline.
- Create top-level implementation directories.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [ ] `pnpm install` can run.
- [ ] Directory ownership matches architecture.
- [ ] No product feature implementation exists.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

None.
