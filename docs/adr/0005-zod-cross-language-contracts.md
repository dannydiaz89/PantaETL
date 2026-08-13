# ADR 0005: Zod-First Cross-Language Contracts

## Status
Superseded by [ADR 0011](0011-json-schema-canonical-contracts.md).

## Decision
Use Zod as canonical TypeScript contract definitions, generate JSON Schema, and prove Pydantic interoperability.

## Consequences
Do not manually maintain duplicate canonical wire schemas.
