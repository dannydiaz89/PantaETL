import { describe, expect, it } from "vitest";

import { componentMetadataSchema } from "../src/components/index.js";

describe("component metadata", () => {
  it("describes form fields and data families", () => {
    const result = componentMetadataSchema.safeParse({
      kind: "source",
      type: "source.rest-api",
      version: "v1",
      displayNameKey: "components.restApi.name",
      descriptionKey: "components.restApi.description",
      configFields: [
        {
          key: "apiToken",
          type: "text",
          labelKey: "components.restApi.apiToken",
          required: true,
          secret: true,
        },
      ],
      inputFamilies: [],
      outputFamilies: ["document"],
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid kinds and unmarked secret field metadata", () => {
    expect(
      componentMetadataSchema.safeParse({
        kind: "database",
        type: "source.csv",
        version: "v1",
        displayNameKey: "components.csv.name",
        descriptionKey: "components.csv.description",
        configFields: [
          {
            key: "path",
            type: "text",
            labelKey: "components.csv.path",
            required: true,
          },
        ],
        inputFamilies: [],
        outputFamilies: ["file"],
      }).success,
    ).toBe(false);
  });
});
