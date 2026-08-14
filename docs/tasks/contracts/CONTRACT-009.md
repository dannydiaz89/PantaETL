# CONTRACT-009 — Config Field Presentation and Default Hints

**Status:** COMPLETE
**Owner:** Claude
**Workstream:** Contracts  
**Depends on:** CONTRACT-003, CONTRACT-007

## Scope

Let a component declare how its configuration fields should be presented and what
value applies when the operator leaves a field alone.

- Optional presentation width per config field.
- Optional declared default value per config field.
- Regenerated Pydantic and TypeScript artifacts.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.
- Component-type-specific rendering branches in the form renderer.

## Acceptance criteria

- [x] Both additions are optional, so existing component metadata stays valid.
- [x] Declared defaults describe the same value the executing component applies.
- [x] Generated Python and TypeScript artifacts match the canonical schema.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

- `pnpm --filter @pantaetl/contracts check`
- `pnpm generate:check`
- `pnpm check`

## Notes / blockers

The renderer previously stretched every control to an equal grid cell, giving a
single-character separator the same width as a file path, and it rendered an
unchecked box for a boolean whose executing default was true. Metadata is the
right place to resolve both, because the renderer must stay generic.
