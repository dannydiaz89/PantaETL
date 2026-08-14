import { describe, expect, it } from "vitest";

import type { ComponentMetadata, PipelineTopologyInput } from "../src/index.js";

import {
  assertPipelineExecutable,
  checkPipelineExecutable,
  PipelineNotExecutableError,
} from "../src/index.js";

const ids = {
  export: "123e4567-e89b-12d3-a456-426614174030",
  source: "123e4567-e89b-12d3-a456-426614174031",
  transform: "123e4567-e89b-12d3-a456-426614174032",
};

function component(
  kind: ComponentMetadata["kind"],
  type: string,
  overrides: Partial<ComponentMetadata> = {},
): ComponentMetadata {
  return {
    kind,
    type,
    version: "v1",
    displayNameKey: `${type}.name`,
    descriptionKey: `${type}.description`,
    configFields: [],
    inputFamilies: kind === "source" ? [] : ["any"],
    outputFamilies: kind === "export" ? [] : ["any"],
    ...overrides,
  };
}

const csvSource = component("source", "source.csv");
const flattenTransform = component("transform", "transform.flatten");
const jsonExport = component("export", "export.json");
const catalog = [csvSource, flattenTransform, jsonExport];

function step(
  id: string,
  kind: "source" | "transform" | "export",
  componentType: string,
  overrides: Partial<PipelineTopologyInput["steps"][number]["configuration"]> = {},
): PipelineTopologyInput["steps"][number] {
  return {
    id,
    kind,
    componentType,
    componentVersion: "v1",
    configuration: { values: {}, secretBindings: [], ...overrides },
  };
}

function linearPipeline(steps: PipelineTopologyInput["steps"]): PipelineTopologyInput {
  const edges = steps.slice(1).map((toStep, index) => ({
    fromStepId: steps[index]?.id ?? "",
    toStepId: toStep.id,
  }));

  return { steps, edges };
}

describe("checkPipelineExecutable", () => {
  it("accepts a connected Source, Transform, and Export chain", () => {
    const pipeline = linearPipeline([
      step(ids.source, "source", "source.csv"),
      step(ids.transform, "transform", "transform.flatten"),
      step(ids.export, "export", "export.json"),
    ]);

    expect(checkPipelineExecutable(pipeline, catalog)).toEqual({ executable: true });
    expect(() => assertPipelineExecutable(pipeline, catalog)).not.toThrow();
  });

  it("accepts a Source connected directly to a compatible Export with zero Transforms", () => {
    const pipeline = linearPipeline([
      step(ids.source, "source", "source.csv"),
      step(ids.export, "export", "export.json"),
    ]);

    expect(checkPipelineExecutable(pipeline, catalog)).toEqual({ executable: true });
  });

  it("rejects a pipeline with no Source step", () => {
    const pipeline = linearPipeline([step(ids.export, "export", "export.json")]);

    const result = checkPipelineExecutable(pipeline, catalog);

    expect(result.executable).toBe(false);
    expect(result).not.toBe(undefined);
    if (!result.executable) {
      expect(result.violations).toContainEqual({ kind: "missing-source" });
    }
  });

  it("rejects a pipeline with no Export step", () => {
    const pipeline = linearPipeline([step(ids.source, "source", "source.csv")]);

    const result = checkPipelineExecutable(pipeline, catalog);

    expect(result.executable).toBe(false);
    if (!result.executable) {
      expect(result.violations).toContainEqual({ kind: "missing-export" });
    }
  });

  it("rejects a pipeline with two Source steps", () => {
    const secondSourceId = "123e4567-e89b-12d3-a456-426614174033";
    const pipeline: PipelineTopologyInput = {
      steps: [
        step(ids.source, "source", "source.csv"),
        step(secondSourceId, "source", "source.csv"),
        step(ids.export, "export", "export.json"),
      ],
      edges: [
        { fromStepId: ids.source, toStepId: ids.export },
        { fromStepId: secondSourceId, toStepId: ids.export },
      ],
    };

    const result = checkPipelineExecutable(pipeline, catalog);

    expect(result.executable).toBe(false);
    if (!result.executable) {
      expect(result.violations).toContainEqual({
        kind: "multiple-sources",
        stepIds: [ids.source, secondSourceId],
      });
    }
  });

  it("rejects a pipeline with two Export steps", () => {
    const secondExportId = "123e4567-e89b-12d3-a456-426614174034";
    const pipeline: PipelineTopologyInput = {
      steps: [
        step(ids.source, "source", "source.csv"),
        step(ids.export, "export", "export.json"),
        step(secondExportId, "export", "export.json"),
      ],
      edges: [{ fromStepId: ids.source, toStepId: ids.export }],
    };

    const result = checkPipelineExecutable(pipeline, catalog);

    expect(result.executable).toBe(false);
    if (!result.executable) {
      expect(result.violations).toContainEqual({
        kind: "multiple-exports",
        stepIds: [ids.export, secondExportId],
      });
    }
  });

  it("rejects a step that is not connected to the Source-to-Export chain", () => {
    const danglingId = "123e4567-e89b-12d3-a456-426614174035";
    const pipeline: PipelineTopologyInput = {
      steps: [
        step(ids.source, "source", "source.csv"),
        step(ids.export, "export", "export.json"),
        step(danglingId, "transform", "transform.flatten"),
      ],
      edges: [{ fromStepId: ids.source, toStepId: ids.export }],
    };

    const result = checkPipelineExecutable(pipeline, catalog);

    expect(result.executable).toBe(false);
    if (!result.executable) {
      expect(result.violations).toContainEqual({ kind: "disconnected-step", stepId: danglingId });
    }
  });

  it("rejects a step whose component type and version are not in the available catalog", () => {
    const pipeline = linearPipeline([
      step(ids.source, "source", "source.csv"),
      step(ids.export, "export", "export.unknown"),
    ]);

    const result = checkPipelineExecutable(pipeline, catalog);

    expect(result.executable).toBe(false);
    if (!result.executable) {
      expect(result.violations).toContainEqual({
        kind: "unavailable-component",
        stepId: ids.export,
        componentType: "export.unknown",
        componentVersion: "v1",
      });
    }
  });

  it("rejects a missing required non-secret configuration value", () => {
    const sourceWithField = component("source", "source.csv", {
      configFields: [
        { key: "path", type: "text", labelKey: "path.label", required: true, secret: false },
      ],
    });
    const pipeline = linearPipeline([
      step(ids.source, "source", "source.csv"),
      step(ids.export, "export", "export.json"),
    ]);

    const result = checkPipelineExecutable(pipeline, [sourceWithField, jsonExport]);

    expect(result.executable).toBe(false);
    if (!result.executable) {
      expect(result.violations).toContainEqual({
        kind: "missing-config-value",
        stepId: ids.source,
        configKey: "path",
      });
    }
  });

  it("rejects a missing required secret binding but accepts a present opaque binding reference", () => {
    const sourceWithSecret = component("source", "source.csv", {
      configFields: [
        { key: "apiKey", type: "text", labelKey: "apiKey.label", required: true, secret: true },
      ],
    });
    const missingBindingPipeline = linearPipeline([
      step(ids.source, "source", "source.csv"),
      step(ids.export, "export", "export.json"),
    ]);

    const missingResult = checkPipelineExecutable(missingBindingPipeline, [sourceWithSecret, jsonExport]);

    expect(missingResult.executable).toBe(false);
    if (!missingResult.executable) {
      expect(missingResult.violations).toContainEqual({
        kind: "missing-secret-binding",
        stepId: ids.source,
        configKey: "apiKey",
      });
    }

    const boundPipeline: PipelineTopologyInput = {
      steps: [
        step(ids.source, "source", "source.csv", {
          secretBindings: [{ key: "apiKey", binding: "SOURCE_API_KEY" }],
        }),
        step(ids.export, "export", "export.json"),
      ],
      edges: [{ fromStepId: ids.source, toStepId: ids.export }],
    };

    expect(checkPipelineExecutable(boundPipeline, [sourceWithSecret, jsonExport])).toEqual({
      executable: true,
    });
  });

  it("rejects adjacent steps whose declared data families are incompatible, with a reason", () => {
    const documentSource = component("source", "source.json", { outputFamilies: ["document"] });
    const tabularExport = component("export", "export.csv", { inputFamilies: ["tabular"] });
    const pipeline = linearPipeline([
      step(ids.source, "source", "source.json"),
      step(ids.export, "export", "export.csv"),
    ]);

    const result = checkPipelineExecutable(pipeline, [documentSource, tabularExport]);

    expect(result.executable).toBe(false);
    if (!result.executable) {
      const violation = result.violations.find(
        (candidate) => candidate.kind === "incompatible-adjacent-steps",
      );
      expect(violation).toMatchObject({
        kind: "incompatible-adjacent-steps",
        upstreamStepId: ids.source,
        downstreamStepId: ids.export,
      });
      if (violation?.kind === "incompatible-adjacent-steps") {
        expect(violation.reason.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("assertPipelineExecutable", () => {
  it("throws PipelineNotExecutableError carrying every violation", () => {
    const pipeline = linearPipeline([step(ids.transform, "transform", "transform.flatten")]);

    try {
      assertPipelineExecutable(pipeline, catalog);
      throw new Error("Expected an incomplete pipeline to fail executable validation.");
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineNotExecutableError);
      const violations = (error as PipelineNotExecutableError).violations;
      expect(violations).toContainEqual({ kind: "missing-source" });
      expect(violations).toContainEqual({ kind: "missing-export" });
    }
  });
});
