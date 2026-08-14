import { pipelineCreateRequestSchema } from "@pantaetl/contracts";
import { describe, expect, it } from "vitest";

import { createPipelineDraft } from "../src/components/pipeline/pipeline-draft.js";
import { getPipelineMutationErrorMessage } from "../src/components/pipeline/pipeline-mutation-feedback.js";
import { PipelineApiError } from "../src/data/pipelines/index.js";
import { createI18n } from "../src/locales/index.js";

describe("pipeline mutation UI", () => {
  it("creates a valid source-to-export draft using only non-secret browser values", () => {
    const sourceId = "733e4567-e89b-12d3-a456-426614174001";
    const exportId = "733e4567-e89b-12d3-a456-426614174002";
    const ids = [sourceId, exportId];
    const request = createPipelineDraft({
      artifactFileName: "  daily-orders.csv  ",
      inputFilePath: "  imports/orders.csv  ",
      name: "  Daily orders  ",
    }, () => ids.shift() ?? "");

    expect(pipelineCreateRequestSchema.safeParse(request).success).toBe(true);
    expect(request).toMatchObject({
      edges: [{ fromStepId: sourceId, toStepId: exportId }],
      name: "Daily orders",
      triggers: [{ enabled: false, type: "manual" }],
    });
    expect(request.steps).toEqual([
      expect.objectContaining({
        componentType: "source.csv",
        configuration: { secretBindings: [], values: { path: "imports/orders.csv" } },
      }),
      expect.objectContaining({
        componentType: "export.csv",
        configuration: { secretBindings: [], values: { fileName: "daily-orders.csv" } },
      }),
    ]);
    expect(request.steps.every((step) => step.configuration.secretBindings.length === 0)).toBe(true);
  });

  it("maps a backend edit lock to an accessible localized message", () => {
    const { t } = createI18n("en-US");

    expect(getPipelineMutationErrorMessage(new PipelineApiError("pipeline_locked", 409), t)).toBe(
      "This pipeline now has a queued or active run. Wait for it to finish or cancel it before changing the configuration.",
    );
  });

  it("maps a failed server-side executable check to an accessible localized message", () => {
    const { t } = createI18n("en-US");

    expect(getPipelineMutationErrorMessage(new PipelineApiError("pipeline_not_executable", 409), t)).toBe(
      "This pipeline cannot be enabled yet because its configuration is incomplete or invalid. Review the Source, Transform, and Export steps and try again.",
    );
  });
});
