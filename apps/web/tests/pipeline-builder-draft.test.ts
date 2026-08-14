import type { ComponentMetadata } from "@pantaetl/contracts";
import { describe, expect, it } from "vitest";

import {
  createEmptyPipelineBuilderDraft,
  nextPipelineBuilderComponentSelection,
  nextPipelineBuilderStep,
  PIPELINE_BUILDER_STEPS,
  previousPipelineBuilderStep,
  setPipelineBuilderSource,
  setPipelineBuilderSourceValues,
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
});

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
