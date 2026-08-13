import { describe, expect, it } from "vitest";

import {
  artifactDescriptorSchema,
  datasetDescriptorSchema,
  DEFAULT_ARTIFACT_RETENTION_DAYS,
} from "../src/dataset/index.js";

const identifiers = {
  artifact: "123e4567-e89b-12d3-a456-426614174001",
  dataset: "123e4567-e89b-12d3-a456-426614174002",
  pipeline: "123e4567-e89b-12d3-a456-426614174003",
  run: "123e4567-e89b-12d3-a456-426614174004",
  step: "123e4567-e89b-12d3-a456-426614174005",
};
const timestamp = "2026-08-13T01:00:00Z";

describe("dataset descriptors", () => {
  it("accepts non-tabular temporary datasets", () => {
    expect(
      datasetDescriptorSchema.safeParse({
        contractVersion: "v1",
        id: identifiers.dataset,
        family: "document",
        format: "json",
        storage: { kind: "local", location: "runs/4/source.json", encrypted: true },
        pipelineId: identifiers.pipeline,
        runId: identifiers.run,
        stepId: identifiers.step,
        createdAt: timestamp,
        expiresAt: "2026-08-14T01:00:00Z",
      }).success,
    ).toBe(true);
  });

  it("rejects storage descriptors that omit encryption metadata", () => {
    expect(
      datasetDescriptorSchema.safeParse({
        contractVersion: "v1",
        id: identifiers.dataset,
        family: "file",
        format: "csv",
        storage: { kind: "local", location: "runs/4/source.csv" },
        pipelineId: identifiers.pipeline,
        runId: identifiers.run,
        stepId: identifiers.step,
        createdAt: timestamp,
        expiresAt: "2026-08-14T01:00:00Z",
      }).success,
    ).toBe(false);
  });
});

describe("artifact descriptors", () => {
  it("carries explicit retention metadata", () => {
    expect(DEFAULT_ARTIFACT_RETENTION_DAYS).toBe(30);
    expect(
      artifactDescriptorSchema.safeParse({
        contractVersion: "v1",
        id: identifiers.artifact,
        pipelineId: identifiers.pipeline,
        runId: identifiers.run,
        format: "parquet",
        fileName: "output.parquet",
        sizeBytes: 128,
        storage: { kind: "s3", location: "artifacts/output.parquet", encrypted: true },
        createdAt: timestamp,
        retention: { expiresAt: "2026-09-12T01:00:00Z", retentionDays: 30 },
      }).success,
    ).toBe(true);
  });
});
