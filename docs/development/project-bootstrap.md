# Project Bootstrap Plan

This documentation package contains no implementation code.

The implementation should be created in three deliberate setup stages before feature work begins.

## Stage 1 — Repository foundation

Create:

- pnpm workspace/root package;
- TypeScript baseline;
- Python 3.13 uv baseline;
- lint/type/test tooling;
- GitHub Actions foundation.

## Stage 2 — Complete application topology

Before designing detailed contracts, create all planned runtime/package boundaries:

```text
PantaETL/
  apps/
    web/
    scheduler/
    garbage-collector/

  workers/
    python/

  packages/
    contracts/
    database/
    ui/
    config/
    logging/
    pipeline/

  schemas/
    generated/

  locales/
    en/

  docker/

  .github/
    workflows/

  compose.yaml
  pnpm-workspace.yaml
```

At this stage:

- TanStack Start should exist and boot as a skeleton;
- scheduler should exist and start as a TypeScript service shell;
- garbage collector should exist and start as a TypeScript service shell;
- Python worker should exist and start under uv;
- package directories should exist with minimal public boundaries;
- Docker Compose should represent the runtime topology;
- no ETL features should be implemented.

## Stage 3 — Shared contracts

With real consumers present, establish:

- identifiers;
- component config;
- Dataset/Artifact;
- Job/Run;
- Pipeline/Trigger;
- JSON Schema generation;
- Pydantic interoperability.

After contracts and basic pipeline-domain rules stabilize, frontend and backend workstreams deliberately fan out in parallel.

## Parallel tracks after contracts

### Frontend

- design system;
- themes/accessibility;
- web shell;
- auth;
- pipeline forms;
- run/system screens.

### Backend control plane

- PostgreSQL schema;
- scheduler;
- garbage collector;
- observability.

### Python execution

- worker runtime;
- dataset storage;
- registries;
- checkpoints;
- ETL components.

Use `ROADMAP.md` and individual task files rather than implementing a whole stage in one change.

## TypeScript

Use pnpm workspaces.

Do not add Turborepo unless pnpm alone demonstrates a concrete limitation.

## Python

Use:

- Python 3.13
- uv
- Ruff
- mypy
- pytest

## CI

GitHub Actions should independently validate:

- TypeScript checks;
- Python checks;
- application skeleton startup/build;
- contract consistency;
- migration consistency;
- accessibility when UI exists.
