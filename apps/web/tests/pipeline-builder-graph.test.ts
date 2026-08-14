import type { ComponentMetadata } from "@pantaetl/contracts";
import { describe, expect, it } from "vitest";

import { createEmptyPipelineBuilderDraft, updatePipelineBuilderDraft } from "../src/components/pipeline/pipeline-builder-draft.js";
import { derivePipelineBuilderEdges, derivePipelineBuilderGraph, derivePipelineBuilderSteps } from "../src/components/pipeline/pipeline-builder-graph.js";

describe("pipeline builder graph derivation", () => {
  it("derives no steps or edges from an empty draft", () => {
    const draft = createEmptyPipelineBuilderDraft();

    expect(derivePipelineBuilderGraph(draft)).toEqual({ steps: [], edges: [] });
  });

  it("connects Source directly to Export with zero Transforms", () => {
    const draft = updatePipelineBuilderDraft(createEmptyPipelineBuilderDraft(), { source: csvSourceSelection, export: jsonExportSelection });

    const { steps, edges } = derivePipelineBuilderGraph(draft);

    expect(steps.map((step) => step.id)).toEqual(["source-1", "export-1"]);
    expect(edges).toEqual([{ fromStepId: "source-1", toStepId: "export-1" }]);
  });

  it("chains Source through a single Transform to Export", () => {
    const draft = updatePipelineBuilderDraft(createEmptyPipelineBuilderDraft(), {
      source: csvSourceSelection,
      transforms: [uppercaseTransformSelection],
      export: jsonExportSelection,
    });

    const { steps, edges } = derivePipelineBuilderGraph(draft);

    expect(steps.map((step) => step.id)).toEqual(["source-1", "transform-1", "export-1"]);
    expect(edges).toEqual([
      { fromStepId: "source-1", toStepId: "transform-1" },
      { fromStepId: "transform-1", toStepId: "export-1" },
    ]);
  });

  it("preserves displayed Transform order across multiple Transforms", () => {
    const draft = updatePipelineBuilderDraft(createEmptyPipelineBuilderDraft(), {
      source: csvSourceSelection,
      transforms: [uppercaseTransformSelection, trimTransformSelection],
      export: jsonExportSelection,
    });

    const { steps, edges } = derivePipelineBuilderGraph(draft);

    expect(steps.map((step) => step.id)).toEqual(["source-1", "transform-1", "transform-2", "export-1"]);
    expect(edges).toEqual([
      { fromStepId: "source-1", toStepId: "transform-1" },
      { fromStepId: "transform-1", toStepId: "transform-2" },
      { fromStepId: "transform-2", toStepId: "export-1" },
    ]);
  });

  it("produces no edges with only a Source selected", () => {
    const draft = updatePipelineBuilderDraft(createEmptyPipelineBuilderDraft(), { source: csvSourceSelection });

    expect(derivePipelineBuilderGraph(draft)).toEqual({ steps: [pipelineStepFromCsvSource()], edges: [] });
  });

  it("chains Source through Transforms with no Export chosen yet", () => {
    const draft = updatePipelineBuilderDraft(createEmptyPipelineBuilderDraft(), {
      source: csvSourceSelection,
      transforms: [uppercaseTransformSelection, trimTransformSelection],
    });

    const { steps, edges } = derivePipelineBuilderGraph(draft);

    expect(steps.map((step) => step.id)).toEqual(["source-1", "transform-1", "transform-2"]);
    expect(edges).toEqual([
      { fromStepId: "source-1", toStepId: "transform-1" },
      { fromStepId: "transform-1", toStepId: "transform-2" },
    ]);
  });

  it("carries each selection's draft-local id forward as the step id", () => {
    const steps = derivePipelineBuilderSteps(
      updatePipelineBuilderDraft(createEmptyPipelineBuilderDraft(), { source: csvSourceSelection, export: jsonExportSelection }),
    );

    expect(steps[0]).toEqual({
      id: "source-1",
      kind: "source",
      componentType: "source.csv",
      componentVersion: "v1",
      configuration: { values: { path: "orders.csv" }, secretBindings: [] },
    });
    expect(steps[1]).toEqual({
      id: "export-1",
      kind: "export",
      componentType: "export.json",
      componentVersion: "v1",
      configuration: { values: {}, secretBindings: [] },
    });
  });

  it("re-derives edges from current order after a Transform reorder, not from the previous edge set", () => {
    const original = updatePipelineBuilderDraft(createEmptyPipelineBuilderDraft(), {
      source: csvSourceSelection,
      transforms: [uppercaseTransformSelection, trimTransformSelection],
      export: jsonExportSelection,
    });
    const reordered = updatePipelineBuilderDraft(original, { transforms: [trimTransformSelection, uppercaseTransformSelection] });

    const edges = derivePipelineBuilderEdges(derivePipelineBuilderSteps(reordered));

    expect(edges).toEqual([
      { fromStepId: "source-1", toStepId: "transform-2" },
      { fromStepId: "transform-2", toStepId: "transform-1" },
      { fromStepId: "transform-1", toStepId: "export-1" },
    ]);
  });
});

const csvSourceMetadata: ComponentMetadata = {
  configFields: [{ key: "path", labelKey: "components.sources.csv.sourcePath", required: true, secret: false, type: "text" }],
  descriptionKey: "components.sources.csv.description",
  displayNameKey: "components.sources.csv.name",
  inputFamilies: [],
  kind: "source",
  outputFamilies: ["tabular"],
  type: "source.csv",
  version: "v1",
};

const uppercaseTransformMetadata: ComponentMetadata = {
  configFields: [],
  descriptionKey: "components.transforms.uppercase.description",
  displayNameKey: "components.transforms.uppercase.name",
  inputFamilies: ["tabular"],
  kind: "transform",
  outputFamilies: ["tabular"],
  type: "transform.uppercase",
  version: "v1",
};

const trimTransformMetadata: ComponentMetadata = {
  configFields: [],
  descriptionKey: "components.transforms.trim.description",
  displayNameKey: "components.transforms.trim.name",
  inputFamilies: ["tabular"],
  kind: "transform",
  outputFamilies: ["tabular"],
  type: "transform.trim",
  version: "v1",
};

const jsonExportMetadata: ComponentMetadata = {
  configFields: [],
  descriptionKey: "components.exports.json.description",
  displayNameKey: "components.exports.json.name",
  inputFamilies: ["tabular"],
  kind: "export",
  outputFamilies: [],
  type: "export.json",
  version: "v1",
};

const csvSourceSelection = { id: "source-1", metadata: csvSourceMetadata, secretBindings: [], values: { path: "orders.csv" } };
const uppercaseTransformSelection = { id: "transform-1", metadata: uppercaseTransformMetadata, secretBindings: [], values: {} };
const trimTransformSelection = { id: "transform-2", metadata: trimTransformMetadata, secretBindings: [], values: {} };
const jsonExportSelection = { id: "export-1", metadata: jsonExportMetadata, secretBindings: [], values: {} };

function pipelineStepFromCsvSource() {
  return {
    id: "source-1",
    kind: "source",
    componentType: "source.csv",
    componentVersion: "v1",
    configuration: { values: { path: "orders.csv" }, secretBindings: [] },
  };
}
