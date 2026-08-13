import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  datasetDescriptorSchema,
  jobSchema,
  runSchema,
  sourceExecutionRequestSchema,
} from "../src/index.js";

const fixturePath = new URL(
  "../../../tests/fixtures/contract-interoperability.json",
  import.meta.url,
);
const fixtures: unknown = JSON.parse(readFileSync(fixturePath, "utf8"));

function fixtureSection(section: "valid" | "invalid"): Record<string, unknown> {
  if (typeof fixtures !== "object" || fixtures === null || !(section in fixtures)) {
    throw new Error("Contract interoperability fixture is malformed.");
  }

  const value = fixtures[section];
  if (typeof value !== "object" || value === null) {
    throw new Error("Contract interoperability fixture section is malformed.");
  }

  return value;
}

const schemas = {
  dataset: datasetDescriptorSchema,
  job: jobSchema,
  sourceExecutionRequest: sourceExecutionRequestSchema,
  run: runSchema,
};

describe("contract interoperability fixtures", () => {
  it("accepts representative Python-boundary payloads", () => {
    const valid = fixtureSection("valid");

    for (const [name, schema] of Object.entries(schemas)) {
      expect(schema.safeParse(valid[name]).success, name).toBe(true);
    }
  });

  it("rejects unsupported contract versions consistently", () => {
    const invalid = fixtureSection("invalid");

    for (const [name, schema] of Object.entries(schemas)) {
      expect(schema.safeParse(invalid[name]).success, name).toBe(false);
    }
  });
});
