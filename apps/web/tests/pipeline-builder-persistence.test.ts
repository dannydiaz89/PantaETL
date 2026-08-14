import type { ComponentMetadata, Pipeline } from "@pantaetl/contracts";
import { describe, expect, it } from "vitest";

import {
  createEmptyPipelineBuilderDraft,
  updatePipelineBuilderDraft,
} from "../src/components/pipeline/pipeline-builder-draft.js";
import {
  createPipelineBuilderDraftFromPipeline,
  createPipelineBuilderMetadataResolver,
  createPipelineCreateRequestFromDraft,
  createPipelineUpdateRequestFromDraft,
  isPipelineBuilderDraftPersistable,
} from "../src/components/pipeline/pipeline-builder-persistence.js";

describe("pipeline builder persistence", () => {
  it("is not persistable without a name, even with components selected", () => {
    const draft = updatePipelineBuilderDraft(createEmptyPipelineBuilderDraft(), { source: csvSourceSelection });

    expect(isPipelineBuilderDraftPersistable({ ...draft, name: "" })).toBe(false);
  });

  it("is not persistable with a name but no components", () => {
    const draft = updatePipelineBuilderDraft(createEmptyPipelineBuilderDraft(), { name: "Orders sync" });

    expect(isPipelineBuilderDraftPersistable(draft)).toBe(false);
  });

  it("is persistable with a name and at least one component, even if incomplete", () => {
    const draft = updatePipelineBuilderDraft(createEmptyPipelineBuilderDraft(), { name: "Orders sync", source: csvSourceSelection });

    expect(isPipelineBuilderDraftPersistable(draft)).toBe(true);
  });

  it("builds a creation request using the existing graph derivation, trimming the name", () => {
    const draft = updatePipelineBuilderDraft(createEmptyPipelineBuilderDraft(), {
      export: jsonExportSelection,
      name: "  Orders sync  ",
      source: csvSourceSelection,
    });

    const request = createPipelineCreateRequestFromDraft(draft);

    expect(request).toEqual({
      contractVersion: "v1",
      edges: [{ fromStepId: "source-1", toStepId: "export-1" }],
      name: "Orders sync",
      steps: [
        {
          componentType: "source.csv",
          componentVersion: "v1",
          configuration: { secretBindings: [], values: { path: "orders.csv" } },
          id: "source-1",
          kind: "source",
        },
        {
          componentType: "export.json",
          componentVersion: "v1",
          configuration: { secretBindings: [], values: {} },
          id: "export-1",
          kind: "export",
        },
      ],
      triggers: [{ enabled: false, type: "manual" }],
    });
  });

  it("builds a graph-only update request without touching triggers or state", () => {
    const draft = updatePipelineBuilderDraft(createEmptyPipelineBuilderDraft(), { name: "Orders sync", source: csvSourceSelection });

    const request = createPipelineUpdateRequestFromDraft(draft);

    expect(request).toEqual({
      edges: [],
      name: "Orders sync",
      steps: [
        {
          componentType: "source.csv",
          componentVersion: "v1",
          configuration: { secretBindings: [], values: { path: "orders.csv" } },
          id: "source-1",
          kind: "source",
        },
      ],
    });
    expect(request).not.toHaveProperty("triggers");
    expect(request).not.toHaveProperty("state");
  });

  it("reconstructs a draft from a persisted pipeline, ordering steps by their edges rather than array order", () => {
    const pipeline = persistedPipeline();

    const draft = createPipelineBuilderDraftFromPipeline(pipeline, resolveMetadata);

    expect(draft).toEqual({
      dirty: false,
      export: jsonExportSelection,
      name: "Orders sync",
      source: csvSourceSelection,
      transforms: [uppercaseTransformSelection],
    });
  });

  it("returns undefined instead of a partial draft when a step's component cannot be resolved", () => {
    const pipeline = persistedPipeline();

    const draft = createPipelineBuilderDraftFromPipeline(pipeline, () => undefined);

    expect(draft).toBeUndefined();
  });

  it("resolves a step's metadata from capability lists grouped by kind, or undefined when its type or version is missing", () => {
    const resolve = createPipelineBuilderMetadataResolver({ export: [jsonExportMetadata], source: [csvSourceMetadata] });
    const configuration = { secretBindings: [], values: {} };

    expect(resolve({ componentType: "source.csv", componentVersion: "v1", configuration, id: "step-1", kind: "source" })).toEqual(csvSourceMetadata);
    expect(resolve({ componentType: "source.csv", componentVersion: "v2", configuration, id: "step-1", kind: "source" })).toBeUndefined();
    expect(resolve({ componentType: "transform.limit", componentVersion: "v1", configuration, id: "step-1", kind: "transform" })).toBeUndefined();
  });
});

function resolveMetadata(step: { componentType: string; componentVersion: string }): ComponentMetadata | undefined {
  const catalog: Record<string, ComponentMetadata> = {
    "export.json@v1": jsonExportMetadata,
    "source.csv@v1": csvSourceMetadata,
    "transform.uppercase@v1": uppercaseTransformMetadata,
  };
  return catalog[`${step.componentType}@${step.componentVersion}`];
}

function persistedPipeline(): Pipeline {
  return {
    contractVersion: "v1",
    createdAt: "2026-08-13T00:00:00.000Z",
    edges: [
      { fromStepId: "source-1", toStepId: "transform-1" },
      { fromStepId: "transform-1", toStepId: "export-1" },
    ],
    id: "933e4567-e89b-12d3-a456-426614174001",
    name: "Orders sync",
    ownerUserId: "933e4567-e89b-12d3-a456-426614174004",
    state: "draft",
    steps: [
      {
        componentType: "export.json",
        componentVersion: "v1",
        configuration: { secretBindings: [], values: {} },
        id: "export-1",
        kind: "export",
      },
      {
        componentType: "source.csv",
        componentVersion: "v1",
        configuration: { secretBindings: [], values: { path: "orders.csv" } },
        id: "source-1",
        kind: "source",
      },
      {
        componentType: "transform.uppercase",
        componentVersion: "v1",
        configuration: { secretBindings: [], values: {} },
        id: "transform-1",
        kind: "transform",
      },
    ],
    triggers: [],
    updatedAt: "2026-08-13T00:00:00.000Z",
  };
}

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
const jsonExportSelection = { id: "export-1", metadata: jsonExportMetadata, secretBindings: [], values: {} };
