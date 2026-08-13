import { describe, expect, it } from "vitest";

import type { ComponentMetadata } from "@pantaetl/contracts";

import {
  assertComponentsCompatible,
  checkComponentCompatibility,
  IncompatiblePipelineComponentsError,
} from "../src/index.js";

function component(
  kind: ComponentMetadata["kind"],
  type: string,
  inputFamilies: ComponentMetadata["inputFamilies"],
  outputFamilies: ComponentMetadata["outputFamilies"],
): ComponentMetadata {
  return {
    kind,
    type,
    version: "v1",
    displayNameKey: `${type}.name`,
    descriptionKey: `${type}.description`,
    configFields: [],
    inputFamilies,
    outputFamilies,
  };
}

const documentSource = component("source", "source.json", [], ["document"]);
const tabularExport = component("export", "export.csv", ["tabular"], []);
const flattenTransform = component("transform", "transform.flatten", ["document"], ["tabular"]);

describe("component compatibility", () => {
  it("rejects a known incompatible data-family connection before execution", () => {
    const result = checkComponentCompatibility(documentSource, tabularExport);

    expect(result).toMatchObject({ compatible: false, compatibleFamilies: [] });
    expect(() => assertComponentsCompatible(documentSource, tabularExport)).toThrow(
      IncompatiblePipelineComponentsError,
    );
  });

  it("allows a Transform to declare the conversion between dataset families", () => {
    expect(checkComponentCompatibility(documentSource, flattenTransform)).toMatchObject({
      compatible: true,
      compatibleFamilies: ["document"],
    });
    expect(checkComponentCompatibility(flattenTransform, tabularExport)).toMatchObject({
      compatible: true,
      compatibleFamilies: ["tabular"],
    });
  });

  it("keeps Source and Export at their respective ends of the data chain", () => {
    expect(checkComponentCompatibility(tabularExport, flattenTransform).compatible).toBe(false);
    expect(checkComponentCompatibility(flattenTransform, documentSource).compatible).toBe(false);
  });
});
