# PantaETL

PantaETL is a self-hosted ETL platform for analysts and data scientists. It is
built around a deliberately small data model:

```text
Trigger → Source → Transform(s) → Export
```

A Trigger decides when a pipeline starts. Sources acquire data, Transforms
operate on datasets without connection credentials, and Exports deliver the
result. This separation keeps pipeline behavior understandable and gives each
component a clear security boundary.

## Project status

The repository has completed its foundation, service scaffolding, and shared
contract milestones. The web app, scheduler, Python worker, garbage collector,
Docker Compose topology, and shared packages are present as validated shells.

The product is **not yet an end-to-end ETL application**: persistence,
scheduling, component registries, pipeline UI, authentication, and ETL
components remain on the roadmap. The currently runnable services are useful
for development and health-check validation, not for processing data.

## Architecture

PantaETL is designed to be self-hosted with a small, understandable service
set:

```text
Web control plane ─┐
Scheduler ─────────┼── PostgreSQL ── Python worker ── Internal storage
Garbage collector ─┘
```

- **Web control plane** — TypeScript/TanStack Start application for pipeline
  configuration, operations, and administration.
- **Scheduler** — TypeScript service that will claim due schedules, create
  runs, and enqueue work.
- **Python worker** — execution plane for Sources, Transforms, and Exports.
- **Garbage collector** — retention cleanup for temporary datasets, artifacts,
  and operational records.
- **PostgreSQL** — planned control-plane data store and initial job queue.
- **Internal storage** — local filesystem by default, with optional
  S3-compatible storage.

The default deployment remains Docker Compose-based. Infrastructure such as
Redis, RabbitMQ, Kafka, MongoDB, and Elasticsearch is intentionally not part of
the baseline.

## Contracts

Versioned cross-service contracts are defined once as JSON Schema in
[`schemas/contracts`](schemas/contracts). Those schemas generate TypeScript
declarations, TypeScript Zod-facing boundary validators, and worker-facing
Pydantic models.

Generated artifacts are committed and checked in CI. Edit the JSON Schema
documents—not generated TypeScript or Python files—when changing a wire
contract. The full rationale is in [ADR 0011](docs/adr/0011-json-schema-canonical-contracts.md).

## Prerequisites

- Node.js 24
- pnpm 10.28.2
- Python 3.13
- [uv](https://docs.astral.sh/uv/)
- Docker Desktop or another Docker Compose implementation (for the full local
  service topology)

## Getting started

Install both language environments from the repository root:

```bash
pnpm install --frozen-lockfile
uv sync --frozen
```

Create your ignored local environment file and replace the example authentication
secret before starting services:

```bash
cp .env.example .env
```

Start the web control plane directly, without Docker:

```bash
pnpm dev
```

It listens on [http://localhost:3000](http://localhost:3000). `pnpm dev` loads
the root `.env` for server-side settings; only `VITE_`-prefixed values would be
available to browser code, so database credentials and authentication secrets
remain server-only.

For database-backed authentication while running without Docker, point
`DATABASE_URL` in `.env` at an already-running local PostgreSQL instance. The
database/user in the template must exist and have the current migrations applied.

To run the other service shells individually:

```bash
pnpm scheduler:dev
pnpm garbage-collector:dev
pnpm worker:dev
```

All three direct commands read the same root `.env`. Scheduler and garbage
collector require `DATABASE_URL`; their default ports are 3010 and 3011.
Garbage collector additionally accepts `GC_INTERVAL_SECONDS`, `GC_BATCH_SIZE`,
and `STORAGE_ROOT`. The current worker health process accepts optional `HOST`,
`PORT`, `WORKER_ID`, and `LOG_LEVEL`; it will use `DATABASE_URL` once job
execution is connected to its process entrypoint.

Or start the complete development topology, including PostgreSQL:

```bash
docker compose up --build
```

The Compose services expose web on port 3000, scheduler on 3010, garbage
collector on 3011, and worker on 3020.

Compose reads the same ignored `.env`, but derives each container's database URL
using the internal PostgreSQL hostname. Production deployments must provide
their own environment or secret-management values rather than copying the
example file.

## Quality checks

Run the full TypeScript and application check suite:

```bash
pnpm check
```

Run the Python checks:

```bash
uv run ruff check .
uv run ruff format --check .
uv run mypy .
uv run pytest
```

After editing a contract, regenerate its language artifacts and run their
staleness checks:

```bash
pnpm --filter @pantaetl/contracts generate:types
uv run python scripts/generate_python_contract_models.py
pnpm --filter @pantaetl/contracts check
uv run python scripts/check_python_contract_models.py
```

## Roadmap and documentation

[`ROADMAP.md`](ROADMAP.md) is the authoritative implementation dashboard. It
tracks completed foundation work and the blocked/ready dependencies for the
next domains.

Architecture, security, data lifecycle, and workstream boundaries are described
in [`docs/architecture`](docs/architecture), [`docs/adr`](docs/adr), and
[`docs/workstreams`](docs/workstreams). Detailed implementation acceptance
criteria live in [`docs/tasks`](docs/tasks).

## License

MIT. See [`LICENSE`](LICENSE).
