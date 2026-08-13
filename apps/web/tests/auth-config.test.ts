import { describe, expect, it } from "vitest";

import { loadAuthConfig } from "../src/auth/config.js";

describe("authentication configuration", () => {
  it("accepts explicit server-only authentication configuration", () => {
    expect(loadAuthConfig({
      BETTER_AUTH_SECRET: "12345678901234567890123456789012",
      BETTER_AUTH_TRUSTED_ORIGINS: "https://pantaetl.test, https://admin.pantaetl.test",
      DATABASE_URL: "postgresql://pantaetl:test@localhost:5432/pantaetl",
    })).toEqual({
      databaseUrl: "postgresql://pantaetl:test@localhost:5432/pantaetl",
      secret: "12345678901234567890123456789012",
      trustedOrigins: ["https://pantaetl.test", "https://admin.pantaetl.test"],
    });
  });

  it("rejects missing or weak session signing configuration", () => {
    expect(() => loadAuthConfig({ DATABASE_URL: "postgresql://pantaetl:test@localhost:5432/pantaetl" })).toThrow();
    expect(() => loadAuthConfig({ BETTER_AUTH_SECRET: "short", DATABASE_URL: "postgresql://pantaetl:test@localhost:5432/pantaetl" })).toThrow();
  });
});
