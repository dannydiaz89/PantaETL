# ADR 0011: JSON Schema Canonical Cross-Language Contracts

## Status

Accepted.

## Decision

Maintain versioned cross-service contracts as JSON Schema documents in
`schemas/contracts`. Generate TypeScript declarations and Python Pydantic models
from those documents. TypeScript boundary validators expose the existing Zod API
while validating against the same canonical JSON Schema semantics.

Generated language artifacts are committed and checked for staleness in CI. They
must not be edited by hand.

## Rationale

JSON Schema is language-neutral and remains stable if the TypeScript validation
library changes. It can describe the public wire format once, while TypeScript
and Python consume mechanically derived artifacts rather than maintaining
separate canonical definitions.

## Consequences

- Contract changes begin in `schemas/contracts` and regenerate both language
  artifacts.
- Zod remains the TypeScript validation interface, but is not the contract
  source of truth.
- Python worker-boundary models are generated Pydantic models rather than thin
  handwritten duplicates.
- Schema features must be supported by the generation and validation toolchain;
  compatibility tests remain required for cross-service behavior.
