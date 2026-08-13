# System Overview

## Purpose

PantaETL is a self-hosted ETL platform for analysts and data scientists.

```text
Trigger
   |
   v
Source -> Transform(s) -> Export
```

Trigger determines when work starts but is not part of the data transformation chain.

## Core services

```text
Web / Control Plane
        |
        v
    PostgreSQL
     /   |    Scheduler |   Garbage Collector
          |
        Worker
          |
     Temporary Storage
```

### Web / control plane

Primary language: TypeScript.

Responsibilities:

- authentication;
- user administration;
- pipeline configuration;
- pipeline import/export;
- run/history views;
- settings;
- API/OpenAPI;
- system health views.

The web service does not perform ETL work.

### PostgreSQL

Stores:

- users;
- pipelines;
- triggers/schedules;
- encrypted connection secrets;
- jobs;
- runs;
- checkpoints;
- artifacts;
- retention metadata;
- activity events;
- API tokens;
- structured metrics/events.

PostgreSQL is also the initial job queue.

### Scheduler

Primary language: TypeScript.

Responsibilities:

- discover due schedules;
- safely claim due work;
- create runs;
- enqueue jobs;
- compute future run times.

Multiple instances may run without a permanent leader.

### Worker

Primary language: Python 3.13.

Responsibilities:

- claim ETL jobs;
- execute Sources;
- execute Transforms;
- execute Exports;
- heartbeat;
- cancellation;
- checkpoint result reporting;
- temporary storage interaction.

### Garbage collector

Responsibilities:

- expired artifact cleanup;
- temporary dataset cleanup;
- stale uploads;
- expired run/log cleanup;
- safe operational-record cleanup.

Deletion is driven by explicit retention/expiration metadata.

## Deployment

Primary:

- Docker Compose;
- PostgreSQL;
- local filesystem;
- one instance of each service.

Optional internal storage: S3-compatible.

Kubernetes may run the same conceptual services later.

No cloud vendor is required.

## Scaling

- Web is stateless aside from shared DB/storage.
- Scheduler instances coordinate through PostgreSQL.
- Workers pull jobs.
- Different pipelines may execute concurrently.
- Same-pipeline runs serialize.
- Garbage collection must be idempotent.

## Infrastructure restraint

Do not add Redis, RabbitMQ, Kafka, MongoDB, Elasticsearch, or another service without an ADR demonstrating a real need.
