import { describe, expect, it } from "vitest";

import { getPipelineMutationErrorMessage } from "../src/components/pipeline/pipeline-mutation-feedback.js";
import { PipelineApiError } from "../src/data/pipelines/index.js";
import { createI18n } from "../src/locales/index.js";

describe("pipeline mutation UI", () => {
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
