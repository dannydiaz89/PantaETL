# CRUD-001 — Pipeline API Contracts

**Status:** COMPLETE
**Owner:** Codex
**Depends on:** None

## Scope

Implement only the behavior described by this task and its acceptance criteria. Inspect the current repository implementation before changing architecture or introducing new abstractions.

## Acceptance criteria

- [x] Add canonical list/create/update/detail/action request-response schemas under packages/contracts.
- [x] Update must not allow arbitrary owner/ID rewrite.
- [x] Secret fields must be write-only or impossible to return accidentally.
- [x] Export all new schemas/types from package public API.
- [x] Ensure OpenAPI generation can consume them.

## Required checks

- relevant unit/integration tests
- TypeScript type checking
- linting
- migration checks if database schema changes
- accessibility checks for UI work
- useful descriptions for exported/non-trivial functions
- no roadmap/task references in implementation comments or commit messages

## Notes / blockers

Pipeline API schemas reference the canonical Pipeline and common identifier schemas. Runtime validators compose the existing Pipeline boundary validators, while OpenAPI mechanically rewrites canonical references to local components without maintaining duplicate endpoint schemas.
