# Workstream: Integration

## Purpose

Prove complete PantaETL workflows after independent frontend/backend workstreams converge.

## Owns

- end-to-end application integration tests;
- representative full pipeline workflows;
- cross-service compatibility validation.

## Does not own

- redefining service contracts to hide incomplete implementations;
- duplicating component logic;
- bypassing normal APIs/job flow.

## Initial scenarios

- file Source → Transform → file Artifact Export;
- scheduled REST Source → Transform → PostgreSQL Export.
