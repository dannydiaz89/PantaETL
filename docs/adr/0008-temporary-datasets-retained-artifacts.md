# ADR 0008: Temporary Datasets and Retained Artifacts

## Status
Accepted.

## Decision
Datasets are temporary execution state. Artifacts are retained file outputs with policy.

## Consequences
Temporary datasets are cleaned after terminal runs. Artifact default retention is 30 days.
