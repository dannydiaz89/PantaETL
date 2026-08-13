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
pnpm setup
```

Create your ignored local environment file and replace the example authentication
secret before starting services:

```bash
cp .env.example .env
```

Start the complete local stack with one command:

```bash
pnpm stack:up
```

It starts PostgreSQL in Docker, waits for it to become healthy, applies committed
migrations, builds the shared packages, and then runs web, scheduler, garbage
collector, and worker locally with labelled combined logs. PostgreSQL is exposed
only on `127.0.0.1:5432`, matching the example `DATABASE_URL`. Press `Ctrl+C` to
stop the local services while keeping PostgreSQL data available. Use these
companion commands when needed:

```bash
pnpm stack:status
pnpm stack:reset # deletes local Compose volumes, then starts a fresh stack
```

Running `pnpm stack:up` again restarts the locally supervised services while
keeping PostgreSQL and its data in place.

`pnpm stack:status` reports the health of web, scheduler, garbage collector,
worker, and Docker PostgreSQL individually.

For development databases created before migration history was tracked, the
migration command verifies the known schema fingerprints, adopts only complete
historical migrations, and applies any missing ones. It refuses incomplete or
unrecognized schema states rather than guessing or deleting data.

Start only the web control plane directly, without Docker:

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

Use Docker Compose directly when you specifically want every service to run in
containers:

```bash
docker compose up --build
```

The Compose services expose web on port 3000, scheduler on 3010, garbage
collector on 3011, worker on 3020, and PostgreSQL on loopback port 5432.

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

After editing a JSON Schema contract or route file, regenerate the committed
artifacts across the stack:

```bash
pnpm generate
```

Verify the generated TypeScript and Pydantic contract artifacts are current
without rewriting repository files:

```bash
pnpm generate:check
```

Database migration generation remains deliberate rather than part of the generic
artifact command:

```bash
pnpm db:migration:generate
pnpm db:migrate
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
