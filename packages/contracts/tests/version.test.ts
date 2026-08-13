import { describe, expect, it } from "vitest";

import {
  CONTRACT_VERSION,
  contractVersionSchema,
  versionedContractSchema,
} from "../src/common/version.js";

describe("contract versioning", () => {
  it("accepts the current version envelope", () => {
    expect(CONTRACT_VERSION).toBe("v1");
    expect(
      versionedContractSchema.safeParse({ contractVersion: CONTRACT_VERSION })
        .success,
    ).toBe(true);
  });

  it("rejects unsupported versions", () => {
    expect(contractVersionSchema.safeParse("v2").success).toBe(false);
  });
});
