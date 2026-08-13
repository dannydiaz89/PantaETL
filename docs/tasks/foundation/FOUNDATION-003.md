# FOUNDATION-003 — Python uv Quality Baseline

**Status:** BLOCKED  
**Owner:** Unassigned  
**Workstream:** Foundation  
**Depends on:** FOUNDATION-001

## Scope

Create Python 3.13 uv project/tooling foundation.

- Python 3.13 pin.
- uv project/lockfile.
- Ruff.
- mypy.
- pytest.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [ ] `uv sync` succeeds.
- [ ] Ruff succeeds.
- [ ] mypy succeeds.
- [ ] pytest succeeds.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

None.
