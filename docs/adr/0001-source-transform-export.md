# ADR 0001: Source → Transform → Export

## Status
Accepted.

## Decision
PantaETL uses Source → Transform → Export. Trigger is separate.

## Rationale
This is understandable to analysts and creates clear security/maintenance boundaries.

## Consequences
Components must preserve responsibility boundaries.
