import { describe, expect, it } from "vitest";

import { generateTemporaryPassword, parseAdminIdentity } from "../src/auth/admin.js";

describe("explicit administrator commands", () => {
  it("validates administrator identities before issuing credentials", () => {
    expect(parseAdminIdentity({ email: "Admin@PantaETL.test", username: "admin" })).toEqual({
      email: "admin@pantaetl.test",
      username: "admin",
    });
    expect(() => parseAdminIdentity({ email: "not-an-email", username: "admin" })).toThrow();
  });

  it("generates non-empty one-time passwords without a fixed value", () => {
    const first = generateTemporaryPassword();
    const second = generateTemporaryPassword();

    expect(first).toHaveLength(32);
    expect(first).not.toBe(second);
  });
});
