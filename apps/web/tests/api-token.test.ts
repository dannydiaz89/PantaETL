import { describe, expect, it } from "vitest";

import { extractBearerToken, generateApiToken, hashApiToken, parseApiTokenName } from "../src/auth/api-token.js";

describe("API token credentials", () => {
  it("generates unique application-issued bearer values and hashes them before persistence", () => {
    const first = generateApiToken();
    const second = generateApiToken();

    expect(first).toMatch(/^pantaetl_[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
    expect(hashApiToken(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashApiToken(first)).not.toBe(first);
  });

  it("accepts only the issued Bearer format, never password-style authorization", () => {
    const token = generateApiToken();

    expect(extractBearerToken(`Bearer ${token}`)).toBe(token);
    expect(extractBearerToken(`bearer ${token}`)).toBe(token);
    expect(extractBearerToken(`Basic ${token}`)).toBeNull();
    expect(extractBearerToken("Bearer password")).toBeNull();
    expect(extractBearerToken(null)).toBeNull();
  });

  it("limits display names without making them part of the credential", () => {
    expect(parseApiTokenName(" deployment automation ")).toBe("deployment automation");
    expect(() => parseApiTokenName("")).toThrow();
    expect(() => parseApiTokenName("a".repeat(129))).toThrow();
  });
});
