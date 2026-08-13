# Cross-Service Contracts

## Goal

TypeScript and Python communicate with versioned validated contracts.

## Planned canonical flow

```text
Zod
  |
JSON Schema
  |
Pydantic interoperability/generation
```

Prove with representative contracts before scaling.

Representative contracts:

- Job;
- Dataset;
- Source execution request;
- Run result.

If generated Pydantic ergonomics are poor, retain JSON Schema as the wire source and enforce compatibility tests against thin handwritten models.

## Python interoperability strategy

Zod definitions and the generated JSON Schema files remain the canonical contract
source. The Python worker uses thin handwritten Pydantic models for representative
worker-boundary payloads. Shared fixture tests require those models to accept and
reject the same Dataset, Job, Source execution request, and Run result payloads as
their Zod counterparts. This keeps the Python API ergonomic without creating a
second canonical schema source.

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
