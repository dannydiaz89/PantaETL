# ADR 0002: PostgreSQL as Initial Job Queue

## Status
Accepted.

## Decision
Use PostgreSQL for initial job queue and orchestration state.

Workers use short row-locking claim transactions such as `FOR UPDATE SKIP LOCKED`.

## Rationale
Self-hosting should minimize infrastructure.

## Consequences
Do not add Redis/RabbitMQ/Kafka without demonstrated need and a new ADR.
