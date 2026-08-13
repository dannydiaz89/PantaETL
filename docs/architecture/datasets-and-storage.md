# Datasets, Artifacts, and Storage

## Dataset

A Dataset is temporary execution data.

It is not durable business data owned by PantaETL.

Descriptors should include:

- ID;
- family/kind;
- format;
- storage location;
- structure/schema metadata when known;
- run/step ownership;
- lifecycle metadata.

## Artifact

An Artifact is a retained file output.

Examples:

- CSV;
- JSON;
- Parquet.

Default retention: 30 days.

Downloading does not delete immediately.

Historical run metadata may remain after artifact expiry.

## Cleanup

Temporary datasets are deleted after terminal runs once no longer needed.

Garbage collection handles leftovers.

## Internal storage

Baseline:

- local filesystem;
- S3-compatible storage.

External systems such as Google Drive belong in Source/Export connectors, not scratch storage.

## Tabular processing

Recommended:

- Polars for execution;
- Arrow/PyArrow for compatible in-memory/interchange representation;
- Parquet for persisted tabular temporary data.

Prefer lazy/scanning execution and streaming sinks.

## Dataset families

At least:

- tabular;
- document/JSON;
- file/binary;
- any/unknown.

Transforms own conversions between supported families.

## Encryption

Temporary data must support encryption at rest.
