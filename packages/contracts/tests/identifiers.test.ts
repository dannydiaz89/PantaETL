import { describe, expect, it } from "vitest";

import {
  artifactIdSchema,
  checkpointIdSchema,
  componentIdSchema,
  datasetIdSchema,
  jobIdSchema,
  pipelineIdSchema,
  runIdSchema,
  timestampSchema,
  userIdSchema,
  versionSchema,
} from "../src/common/index.js";

const validIdentifier = "123e4567-e89b-12d3-a456-426614174000";

describe("core identifiers", () => {
  it("validates every canonical identifier type", () => {
    for (const schema of [
      pipelineIdSchema,
      runIdSchema,
      jobIdSchema,
      datasetIdSchema,
      artifactIdSchema,
      userIdSchema,
      componentIdSchema,
      checkpointIdSchema,
    ]) {
      expect(schema.safeParse(validIdentifier).success).toBe(true);
    }
  });

  it("rejects malformed identifiers", () => {
    expect(pipelineIdSchema.safeParse("pipeline-1").success).toBe(false);
  });
});

describe("shared primitives", () => {
  it("requires offset-bearing timestamps and major versions", () => {
    expect(timestampSchema.safeParse("2026-08-13T01:00:00Z").success).toBe(true);
    expect(timestampSchema.safeParse("2026-08-13").success).toBe(false);
    expect(versionSchema.safeParse("v1").success).toBe(true);
    expect(versionSchema.safeParse("1").success).toBe(false);
  });
});
