# WORKER-004 — Source/Transform/Export Registries

**Status:** COMPLETE
**Owner:** Codex
**Workstream:** Worker
**Workstream:** Worker  
**Depends on:** WORKER-001, CONTRACT-003, PIPELINE-003

## Scope

Implement modular runtime registries.

- Source registry.
- Transform registry.
- Export registry.
- Metadata/config validation.

## Out of scope

- Unrelated workstreams.
- Product feature implementation beyond this task.
- Architecture changes not required by this task.

## Acceptance criteria

- [x] Adding component avoids central switch.
- [x] Transform modules stay focused.

## Validation

Run all checks relevant to the packages/services introduced or changed by this task.

## Notes / blockers

Added focused Source, Transform, and Export registries keyed by component type
and version. Registry metadata validates portable configuration values and keeps
secret fields at the binding boundary.
