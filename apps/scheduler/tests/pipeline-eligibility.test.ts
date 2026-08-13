import { describe, expect, it } from "vitest";

import { getPipelineSchedulingEligibility } from "../src/pipeline-eligibility.js";

describe("getPipelineSchedulingEligibility", () => {
  it("allows only enabled pipelines to receive scheduled work", () => {
    expect(getPipelineSchedulingEligibility("enabled")).toBe("eligible");
    expect(getPipelineSchedulingEligibility("draft")).toBe("ineligible");
    expect(getPipelineSchedulingEligibility("disabled")).toBe("ineligible");
  });

  it("rejects values outside the canonical pipeline-state contract", () => {
    expect(getPipelineSchedulingEligibility("running")).toBe("invalid");
    expect(getPipelineSchedulingEligibility(undefined)).toBe("invalid");
  });
});
