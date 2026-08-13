# PantaETL

PantaETL is a self-hosted ETL platform built around a simple model:

**Source → Transform → Export**

A Trigger starts a pipeline. A Source acquires data. Zero or more Transform components manipulate it. An Export delivers the result.

This starter repository intentionally contains **documentation only**. The codebase should be created from these specifications, roadmap tasks, workstream boundaries, and agent instructions. The roadmap deliberately scaffolds the complete application before shared contracts, then fans out into parallel frontend and backend implementation.

## Project principles

- Self-hosting is the primary deployment model.
- Docker Compose is the baseline deployment experience.
- PostgreSQL is the control-plane database and initial job queue.
- Source, Transform, and Export have strict responsibility boundaries.
- Temporary datasets are disposable execution state.
- File artifacts may be retained according to policy.
- Pipelines own their connections and schedules.
- Different pipelines may run concurrently.
- A single pipeline may have only one active run at a time.
- Accessibility is mandatory.
- Internationalization begins with the first implementation.
- The design system is mandatory.
- No emojis are used in the application UI.
- Code is written for long-term human maintainability.
- Architecture decisions are explicit and versioned.
- Work is broken down so multiple contributors or agents can proceed concurrently.

## Planned stack

### TypeScript control plane

- TypeScript
- pnpm workspaces
- TanStack Start
- TanStack Router
- TanStack Query
- TanStack Form
- TanStack Table
- Zod
- Drizzle ORM / Drizzle Kit
- Better Auth
- Tailwind CSS
- Radix Primitives behind PantaETL's design system
- Lucide
- Vitest
- Playwright

### Python execution plane

- Python 3.13
- uv
- Pydantic
- Polars
- PyArrow
- Parquet
- Ruff
- mypy
- pytest

### Infrastructure

- PostgreSQL
- local filesystem by default
- optional S3-compatible storage
- Docker Compose
- GitHub Actions
- MIT License

## Start here

1. `AGENTS.md`
2. `CLAUDE.md` if using Claude-based coding agents
3. `ROADMAP.md`
4. `docs/tasks/README.md`
5. the assigned task file under `docs/tasks/`
6. the relevant workstream under `docs/workstreams/`
7. the relevant architecture docs under `docs/architecture/`
8. applicable ADRs under `docs/adr/`

## Documentation model

```text
Architecture
"What are we building and why?"
        |
        v
Workstreams
"Who owns each area?"
        |
        v
Roadmap
"What work exists and what is its state?"
        |
        v
Task files
"What exactly must be done?"
```

## Status

Architecture baseline: **v0.1**

Implementation status: **Not started**
