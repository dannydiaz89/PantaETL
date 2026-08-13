# ADR 0004: Polars, Arrow, and Parquet

## Status
Accepted.

## Decision
Use Polars for tabular execution, Arrow/PyArrow for compatible interchange, and Parquet for persisted temporary tabular datasets.

## Rationale
Support larger-than-memory processing without inventing a custom streaming protocol.

## Consequences
Pandas is not the canonical core engine representation.
