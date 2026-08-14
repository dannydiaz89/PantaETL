import type { ComponentMetadata } from "@pantaetl/contracts";
import { describe, expect, it } from "vitest";

import { createPipelineBuilderCompatibilityResolver } from "../src/components/pipeline/pipeline-builder-compatibility.js";

describe("pipeline builder compatibility resolver", () => {
  it("enables every option when there is no upstream component yet", () => {
    const resolve = createPipelineBuilderCompatibilityResolver(undefined, "Incompatible.");

    expect(resolve(tabularTransform)).toEqual({ disabled: false, reason: undefined });
    expect(resolve(documentTransform)).toEqual({ disabled: false, reason: undefined });
  });

  it("enables a component whose input family overlaps the upstream's output family", () => {
    const resolve = createPipelineBuilderCompatibilityResolver(csvSource, "Incompatible.");

    expect(resolve(tabularTransform)).toEqual({ disabled: false, reason: undefined });
  });

  it("disables a component with no overlapping family, with the supplied localized reason", () => {
    const resolve = createPipelineBuilderCompatibilityResolver(csvSource, "Incompatible.");

    expect(resolve(documentTransform)).toEqual({ disabled: true, reason: "Incompatible." });
  });
});

const csvSource: ComponentMetadata = {
  configFields: [],
  descriptionKey: "components.sources.csv.description",
  displayNameKey: "components.sources.csv.name",
  inputFamilies: [],
  kind: "source",
  outputFamilies: ["tabular"],
  type: "source.csv",
  version: "v1",
};

const tabularTransform: ComponentMetadata = {
  configFields: [],
  descriptionKey: "components.transforms.rows.limit.description",
  displayNameKey: "components.transforms.rows.limit.name",
  inputFamilies: ["tabular"],
  kind: "transform",
  outputFamilies: ["tabular"],
  type: "transform.limit",
  version: "v1",
};

const documentTransform: ComponentMetadata = {
  configFields: [],
  descriptionKey: "components.transforms.flatten.description",
  displayNameKey: "components.transforms.flatten.name",
  inputFamilies: ["document"],
  kind: "transform",
  outputFamilies: ["tabular"],
  type: "transform.flatten",
  version: "v1",
};
