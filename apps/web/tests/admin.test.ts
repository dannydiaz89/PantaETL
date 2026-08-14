import { describe, expect, it } from "vitest";

import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
  MINIMUM_ADMIN_PASSWORD_LENGTH,
  generateTemporaryPassword,
  parseAdminIdentity,
} from "../src/auth/admin.js";

describe("explicit administrator commands", () => {
  it("validates administrator identities before issuing credentials", () => {
    expect(parseAdminIdentity({ email: "Admin@PantaETL.test", username: "admin" })).toEqual({
      email: "admin@pantaetl.test",
      username: "admin",
    });
    expect(() => parseAdminIdentity({ email: "not-an-email", username: "admin" })).toThrow();
  });

  it("falls back to the first-run identity so a new deployment needs no configuration", () => {
    expect(parseAdminIdentity({})).toEqual({ email: DEFAULT_ADMIN_EMAIL, username: DEFAULT_ADMIN_USERNAME });
    expect(parseAdminIdentity({ email: "   ", username: "  " })).toEqual({
      email: DEFAULT_ADMIN_EMAIL,
      username: DEFAULT_ADMIN_USERNAME,
    });
  });

  it("keeps the published first-run credentials in step with the setup rules that retire them", () => {
    // The setup screen refuses to keep this password, so it must fail its own strength rule.
    expect(DEFAULT_ADMIN_PASSWORD.length).toBeLessThan(MINIMUM_ADMIN_PASSWORD_LENGTH);
  });

  it("generates non-empty one-time passwords without a fixed value", () => {
    const first = generateTemporaryPassword();
    const second = generateTemporaryPassword();

    expect(first).toHaveLength(32);
    expect(first).not.toBe(second);
  });
});
