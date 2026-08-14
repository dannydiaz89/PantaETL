import type { ComponentMetadata } from "@pantaetl/contracts";
import { describe, expect, it } from "vitest";

import {
  addPipelineBuilderTransform,
  createEmptyPipelineBuilderDraft,
  isPipelineBuilderDraftComplete,
  movePipelineBuilderTransform,
  nextPipelineBuilderComponentSelection,
  nextPipelineBuilderStep,
  pipelineBuilderChainTail,
  PIPELINE_BUILDER_STEPS,
  previousPipelineBuilderStep,
  removePipelineBuilderTransform,
  setPipelineBuilderExport,
  setPipelineBuilderExportValues,
  setPipelineBuilderSource,
  setPipelineBuilderSourceValues,
  setPipelineBuilderTransformValues,
  updatePipelineBuilderDraft,
} from "../src/components/pipeline/pipeline-builder-draft.js";

describe("pipeline builder draft model", () => {
  it("starts as a clean, empty draft", () => {
    expect(createEmptyPipelineBuilderDraft()).toEqual({
      dirty: false,
      export: undefined,
      name: "",
      source: undefined,
      transforms: [],
    });
  });

  it("declares exactly three ordered stages", () => {
    expect(PIPELINE_BUILDER_STEPS).toEqual(["source", "transforms", "export"]);
  });

  it("applies a change without mutating the original draft and marks the result dirty", () => {
    const draft = createEmptyPipelineBuilderDraft();
    const updated = updatePipelineBuilderDraft(draft, { name: "Orders sync" });

    expect(draft).toEqual(createEmptyPipelineBuilderDraft());
    expect(updated).toEqual({ dirty: true, export: undefined, name: "Orders sync", source: undefined, transforms: [] });
  });

  it("preserves already-entered fields across a Next then Back navigation round trip", () => {
    let draft = createEmptyPipelineBuilderDraft();
    draft = updatePipelineBuilderDraft(draft, { name: "Orders sync" });

    const afterNext = nextPipelineBuilderStep("source");
    expect(afterNext).toBe("transforms");

    const afterBack = afterNext === undefined ? undefined : previousPipelineBuilderStep(afterNext);
    expect(afterBack).toBe("source");
    expect(draft.name).toBe("Orders sync");
  });

  it("has no step before source or after export", () => {
    expect(previousPipelineBuilderStep("source")).toBeUndefined();
    expect(nextPipelineBuilderStep("export")).toBeUndefined();
  });

  it("walks the full linear order forward and backward", () => {
    expect(nextPipelineBuilderStep("source")).toBe("transforms");
    expect(nextPipelineBuilderStep("transforms")).toBe("export");
    expect(previousPipelineBuilderStep("export")).toBe("transforms");
    expect(previousPipelineBuilderStep("transforms")).toBe("source");
  });

  it("assigns a new draft-local id when a slot is selected for the first time", () => {
    const selection = nextPipelineBuilderComponentSelection(undefined, csvSource, () => "generated-id");

    expect(selection).toEqual({ id: "generated-id", metadata: csvSource, secretBindings: [], values: {} });
  });

  it("keeps the slot id and configuration when reselecting the identical component", () => {
    const current = { id: "existing-id", metadata: csvSource, secretBindings: [], values: { path: "orders.csv" } };

    const selection = nextPipelineBuilderComponentSelection(current, csvSource, () => "unused");

    expect(selection).toEqual(current);
  });

  it("keeps the slot id but clears configuration when the component type changes", () => {
    const current = { id: "existing-id", metadata: csvSource, secretBindings: [], values: { path: "orders.csv" } };

    const selection = nextPipelineBuilderComponentSelection(current, restSource, () => "unused");

    expect(selection).toEqual({ id: "existing-id", metadata: restSource, secretBindings: [], values: {} });
  });

  it("sets the draft Source and preserves its id across reselecting a different component", () => {
    let draft = createEmptyPipelineBuilderDraft();
    draft = setPipelineBuilderSource(draft, csvSource, () => "source-id");
    draft = setPipelineBuilderSourceValues(draft, { path: "orders.csv" });

    draft = setPipelineBuilderSource(draft, restSource, () => "unused");

    expect(draft.source).toEqual({ id: "source-id", metadata: restSource, secretBindings: [], values: {} });
    expect(draft.dirty).toBe(true);
  });

  it("does nothing when setting Source values without a selected Source", () => {
    const draft = createEmptyPipelineBuilderDraft();

    expect(setPipelineBuilderSourceValues(draft, { path: "orders.csv" })).toBe(draft);
  });

  it("allows zero Transforms and appends added Transforms with fresh ids in order", () => {
    let draft = createEmptyPipelineBuilderDraft();
    expect(draft.transforms).toEqual([]);

    let nextId = 0;
    const createId = () => `transform-${++nextId}`;
    draft = addPipelineBuilderTransform(draft, limitTransform, createId);
    draft = addPipelineBuilderTransform(draft, fillNullTransform, createId);

    expect(draft.transforms).toEqual([
      { id: "transform-1", metadata: limitTransform, secretBindings: [], values: {} },
      { id: "transform-2", metadata: fillNullTransform, secretBindings: [], values: {} },
    ]);
  });

  it("replaces one Transform's configuration values by id without affecting the others", () => {
    let draft = createEmptyPipelineBuilderDraft();
    draft = addPipelineBuilderTransform(draft, limitTransform, () => "t1");
    draft = addPipelineBuilderTransform(draft, fillNullTransform, () => "t2");

    draft = setPipelineBuilderTransformValues(draft, "t1", { count: 10 });

    expect(draft.transforms[0]).toEqual({ id: "t1", metadata: limitTransform, secretBindings: [], values: { count: 10 } });
    expect(draft.transforms[1]).toEqual({ id: "t2", metadata: fillNullTransform, secretBindings: [], values: {} });
  });

  it("removes a Transform by id and keeps the remaining ids and order", () => {
    let draft = createEmptyPipelineBuilderDraft();
    draft = addPipelineBuilderTransform(draft, limitTransform, () => "t1");
    draft = addPipelineBuilderTransform(draft, fillNullTransform, () => "t2");

    draft = removePipelineBuilderTransform(draft, "t1");

    expect(draft.transforms).toEqual([{ id: "t2", metadata: fillNullTransform, secretBindings: [], values: {} }]);
  });

  it("reorders Transforms without recreating their ids", () => {
    let draft = createEmptyPipelineBuilderDraft();
    draft = addPipelineBuilderTransform(draft, limitTransform, () => "t1");
    draft = addPipelineBuilderTransform(draft, fillNullTransform, () => "t2");

    draft = movePipelineBuilderTransform(draft, "t2", "up");

    expect(draft.transforms.map((transform) => transform.id)).toEqual(["t2", "t1"]);
  });

  it("does not move a Transform past either end of the list", () => {
    let draft = createEmptyPipelineBuilderDraft();
    draft = addPipelineBuilderTransform(draft, limitTransform, () => "t1");
    draft = addPipelineBuilderTransform(draft, fillNullTransform, () => "t2");

    const atStart = movePipelineBuilderTransform(draft, "t1", "up");
    const atEnd = movePipelineBuilderTransform(draft, "t2", "down");

    expect(atStart.transforms.map((transform) => transform.id)).toEqual(["t1", "t2"]);
    expect(atEnd.transforms.map((transform) => transform.id)).toEqual(["t1", "t2"]);
  });

  it("sets the draft Export and preserves its id across reselecting a different component", () => {
    let draft = createEmptyPipelineBuilderDraft();
    draft = setPipelineBuilderExport(draft, jsonExport, () => "export-id");
    draft = setPipelineBuilderExportValues(draft, { fileName: "orders.json" });

    draft = setPipelineBuilderExport(draft, csvExport, () => "unused");

    expect(draft.export).toEqual({ id: "export-id", metadata: csvExport, secretBindings: [], values: {} });
  });

  it("does nothing when setting Export values without a selected Export", () => {
    const draft = createEmptyPipelineBuilderDraft();

    expect(setPipelineBuilderExportValues(draft, { fileName: "orders.json" })).toBe(draft);
  });

  it("is complete only once both a Source and an Export are selected", () => {
    let draft = createEmptyPipelineBuilderDraft();
    expect(isPipelineBuilderDraftComplete(draft)).toBe(false);

    draft = setPipelineBuilderSource(draft, csvSource, () => "source-id");
    expect(isPipelineBuilderDraftComplete(draft)).toBe(false);

    draft = setPipelineBuilderExport(draft, jsonExport, () => "export-id");
    expect(isPipelineBuilderDraftComplete(draft)).toBe(true);
  });

  it("has no chain tail for an empty draft", () => {
    expect(pipelineBuilderChainTail(createEmptyPipelineBuilderDraft())).toBeUndefined();
  });

  it("uses the Source as the chain tail until a Transform is added", () => {
    let draft = createEmptyPipelineBuilderDraft();
    draft = setPipelineBuilderSource(draft, csvSource, () => "source-id");

    expect(pipelineBuilderChainTail(draft)).toEqual(csvSource);
  });

  it("uses the last added Transform as the chain tail", () => {
    let draft = createEmptyPipelineBuilderDraft();
    draft = setPipelineBuilderSource(draft, csvSource, () => "source-id");
    draft = addPipelineBuilderTransform(draft, limitTransform, () => "t1");
    draft = addPipelineBuilderTransform(draft, fillNullTransform, () => "t2");

    expect(pipelineBuilderChainTail(draft)).toEqual(fillNullTransform);
  });
});

const jsonExport: ComponentMetadata = {
  configFields: [{ key: "fileName", labelKey: "components.exports.json.fileName", required: true, secret: false, type: "text" }],
  descriptionKey: "components.exports.json.description",
  displayNameKey: "components.exports.json.name",
  inputFamilies: ["tabular"],
  kind: "export",
  outputFamilies: [],
  type: "export.json",
  version: "v1",
};

const csvExport: ComponentMetadata = {
  configFields: [{ key: "fileName", labelKey: "components.exports.csv.fileName", required: true, secret: false, type: "text" }],
  descriptionKey: "components.exports.csv.description",
  displayNameKey: "components.exports.csv.name",
  inputFamilies: ["tabular"],
  kind: "export",
  outputFamilies: [],
  type: "export.csv",
  version: "v1",
};

const limitTransform: ComponentMetadata = {
  configFields: [{ key: "count", labelKey: "components.transforms.rows.limit.count", required: true, secret: false, type: "number" }],
  descriptionKey: "components.transforms.rows.limit.description",
  displayNameKey: "components.transforms.rows.limit.name",
  inputFamilies: ["tabular"],
  kind: "transform",
  outputFamilies: ["tabular"],
  type: "transform.limit",
  version: "v1",
};

const fillNullTransform: ComponentMetadata = {
  configFields: [
    { key: "column", labelKey: "components.transforms.values.fillNull.column", required: true, secret: false, type: "text" },
    { key: "value", labelKey: "components.transforms.values.fillNull.value", required: true, secret: false, type: "text" },
  ],
  descriptionKey: "components.transforms.values.fillNull.description",
  displayNameKey: "components.transforms.values.fillNull.name",
  inputFamilies: ["tabular"],
  kind: "transform",
  outputFamilies: ["tabular"],
  type: "transform.values.fill-null",
  version: "v1",
};

const csvSource: ComponentMetadata = {
  configFields: [{ key: "path", labelKey: "components.sources.csv.sourcePath", required: true, secret: false, type: "text" }],
  descriptionKey: "components.sources.csv.description",
  displayNameKey: "components.sources.csv.name",
  inputFamilies: [],
  kind: "source",
  outputFamilies: ["tabular"],
  type: "source.csv",
  version: "v1",
};

const restSource: ComponentMetadata = {
  configFields: [{ key: "url", labelKey: "components.sources.rest.url", required: true, secret: false, type: "text" }],
  descriptionKey: "components.sources.rest.description",
  displayNameKey: "components.sources.rest.name",
  inputFamilies: [],
  kind: "source",
  outputFamilies: ["document"],
  type: "source.rest-api",
  version: "v1",
};
