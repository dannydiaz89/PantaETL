# CONTRACT-008 — Pydantic Interoperability Proof

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Contracts  
**Depends on:** CONTRACT-007, APP-004

## Scope

Validate representative cross-service payloads cleanly in Python.

- Dataset.
- Job.
- Source execution request.
- Run result.
- Evaluate generated vs thin handwritten Pydantic strategy.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Valid payloads pass in TypeScript/Python.
- [x] Invalid payloads fail consistently.
- [x] Interoperability strategy documented.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

- `pnpm --filter @pantaetl/contracts check`
- `uv sync --frozen && uv run ruff check . && uv run ruff format --check . && uv run mypy . && uv run pytest`
- `pnpm check`

## Notes / blockers

Added a Source execution request contract, generated Pydantic models for the
representative worker boundary, and a shared fixture tested by both TypeScript and
Python. Canonical JSON Schema generates both language artifacts, and CI rejects
stale generated Pydantic models.
