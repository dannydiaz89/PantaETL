# API and Observability

## API

Expose a documented control-plane API.

Expected areas:

- pipelines;
- runs;
- artifacts;
- system status;
- tokens;
- authorized users/settings.

## OpenAPI

Zod is the TypeScript validation source.

Generate or mechanically align OpenAPI from the same contracts.

Avoid independent TypeScript types, validators, and Swagger definitions.

Expose:

- OpenAPI JSON;
- Swagger-style interactive docs.

## Authentication

Automation uses revocable API tokens.

## Observability

Initial operational data lives in PostgreSQL.

Track:

- run/step lifecycle;
- records read/written;
- bytes;
- duration;
- retries;
- worker;
- queue depth;
- scheduler health;
- garbage collector health.

## Correlation

Use pipeline/run/job/worker IDs where applicable.

## Logs

System-wide log level.

Default run/log retention: one year, configurable.

Do not log records/secrets.

## System health

Report application-level health.

Host/container metrics remain admin infrastructure responsibility.
