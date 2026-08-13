# ADR 0005: Zod-First Cross-Language Contracts

## Status
Accepted with proof-of-concept requirement.

## Decision
Use Zod as canonical TypeScript contract definitions, generate JSON Schema, and prove Pydantic interoperability.

## Consequences
Do not manually maintain duplicate canonical wire schemas.
