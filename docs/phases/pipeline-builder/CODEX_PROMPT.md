# Codex Prompt

Use from the PantaETL repository root:

> Read `AGENTS.md`, the existing architecture documentation, and the phase overview files under `docs/phases/pipeline-builder/`. Treat `docs/phases/pipeline-builder/PHASE_ROADMAP.md` as the authoritative tracker. The selected UX is the three-step Source → Transforms → Export wizard described in `UX_SPEC.md` and shown in `UI_REFERENCE.png` when present. Do not implement a generic graph canvas and do not hardcode CSV-specific creation behavior.
>
> Begin with the first READY task. Before changing code, inspect the current implementation related to that task and preserve existing contracts, registries, CRUD APIs, pipeline-domain rules, localization, accessibility, and design-system boundaries. Mark the task and roadmap row IN PROGRESS, set an owner if available, complete only that task and all acceptance criteria, run required checks, then mark it COMPLETE. Do not automatically start another task unless explicitly instructed.

For parallel agents:

> Read `AGENTS.md`, the pipeline-builder phase overview/guidance, and the assigned task file. Verify dependencies are COMPLETE, claim only that task, and remain within scope. Reuse canonical ComponentMetadata, Pipeline contracts, CRUD APIs, and shared compatibility logic. Do not add hand-maintained frontend component catalogs or component-specific React forms when metadata can represent the configuration.
