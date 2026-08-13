import { defineConfig } from "@playwright/test";

/** Browser test configuration for representative accessibility checks. */
export default defineConfig({
  fullyParallel: true,
  reporter: process.env.CI === "true" ? [["github"], ["list"]] : "list",
  testDir: "./tests",
  testMatch: "**/*.e2e.ts",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm --filter web dev",
    env: {
      BETTER_AUTH_SECRET: "accessibility-test-secret-not-for-production",
      BETTER_AUTH_TRUSTED_ORIGINS: "http://127.0.0.1:3000",
      BETTER_AUTH_URL: "http://127.0.0.1:3000",
      DATABASE_URL: "postgresql://pantaetl:pantaetl@127.0.0.1:5432/pantaetl",
    },
    reuseExistingServer: process.env.CI !== "true",
    url: "http://127.0.0.1:3000",
  },
});
