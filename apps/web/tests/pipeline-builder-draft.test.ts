import { describe, expect, it } from "vitest";

import {
  createEmptyPipelineBuilderDraft,
  nextPipelineBuilderStep,
  PIPELINE_BUILDER_STEPS,
  previousPipelineBuilderStep,
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
});
