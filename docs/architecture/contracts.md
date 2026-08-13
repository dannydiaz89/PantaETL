# Cross-Service Contracts

## Goal

TypeScript and Python communicate with versioned validated contracts.

## Canonical flow

```text
JSON Schema
  |
  +-- TypeScript declarations and Zod boundary validators
  |
  +-- Python Pydantic models
```

The hand-maintained JSON Schema documents in `schemas/contracts` are the
language-neutral source of truth. Generated TypeScript and Python artifacts are
committed for review and checked for staleness in CI.

Representative contracts:

- Job;
- Dataset;
- Source execution request;
- Run result.

## Python interoperability strategy

Pydantic models for worker-boundary payloads are generated from the same JSON
Schema documents. Shared fixtures require the TypeScript and Python validators to
accept and reject the same Dataset, Job, Source execution request, and Run result
payloads.

Zod remains the TypeScript-facing validation API. Its validators are derived from
the canonical schemas and checked with JSON Schema validation so unsupported or
implementation-specific converter behavior cannot weaken the wire contract.

## Package layout

```text
packages/contracts/
  common/
  pipeline/
  execution/
  dataset/
  components/
  api/
```

Avoid a giant schema file.

## Versioning

Payloads include explicit version information where compatibility matters.

Services must not silently process unsupported contracts.

## UI configuration

Component schemas should support validation and, where reasonable, configuration forms.

Secret fields remain identifiable for protected rendering and redaction.
