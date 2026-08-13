# SOURCE-004 — REST API Source

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Sources  
**Depends on:** WORKER-004, WORKER-006

## Scope

Implement REST Source.

- URL/path.
- Query params.
- Headers.
- Secret fields.
- Pagination/checkpoint hooks.
- Redaction.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Checkpoint candidate supported.
- [x] Secrets redact.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

The REST Source validates safe HTTP requests, resolves only assigned secret
bindings, redacts sensitive request context, and holds pagination/checkpoint
candidates until the successful pipeline lifecycle commits them.
