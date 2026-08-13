# Coding Standards

## Function descriptions

Exported/public functions and non-trivial internal functions must be documented.

Useful descriptions explain:

- responsibility;
- transaction/locking expectations;
- checkpoint behavior;
- network I/O;
- data deletion;
- secret requirements;
- retry behavior;
- important errors.

Avoid ceremonial descriptions.

## Comments

Comments explain:

- why;
- invariants;
- race-condition prevention;
- security assumptions;
- non-obvious tradeoffs.

Comments do not restate readable code or reference task/planning documents.

## Errors

Errors should be actionable, safe, and structured where appropriate.

Do not leak credentials, records, or stack traces to ordinary users.

## Boundaries

Validate:

- HTTP input;
- job payloads;
- component config;
- worker results;
- pipeline imports.

## TypeScript

- strict typing;
- Zod validation;
- Drizzle for normal DB access;
- raw SQL for PostgreSQL-specific patterns when clearer;
- avoid `any`.

## Python

- type annotations;
- Pydantic boundaries;
- Polars for tabular core;
- Ruff;
- mypy;
- pytest.

## User-facing strings

All visible text is localized.
