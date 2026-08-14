import { defineConfig } from "@playwright/test";

const playwrightPort = parsePlaywrightPort(process.env.PLAYWRIGHT_PORT);
const playwrightBaseUrl = `http://127.0.0.1:${playwrightPort}`;

/** Browser test configuration for representative accessibility checks. */
export default defineConfig({
  fullyParallel: true,
  reporter: process.env.CI === "true" ? [["github"], ["list"]] : "list",
  testDir: "./tests",
  testMatch: "**/*.e2e.ts",
  timeout: 30_000,
  use: {
    baseURL: playwrightBaseUrl,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm --filter web exec vite dev --host 127.0.0.1 --port ${playwrightPort}`,
    env: {
      BETTER_AUTH_SECRET: "accessibility-test-secret-not-for-production",
      BETTER_AUTH_TRUSTED_ORIGINS: playwrightBaseUrl,
      BETTER_AUTH_URL: playwrightBaseUrl,
      DATABASE_URL: "postgresql://pantaetl:pantaetl-dev@127.0.0.1:5432/pantaetl",
      SCHEDULER_INTERNAL_TOKEN: "scheduler-internal-token-for-a11y-tests",
    },
    reuseExistingServer: process.env.CI !== "true",
    url: playwrightBaseUrl,
  },
});

/** Parses a local browser-test port before interpolating it into the Vite launch command. */
function parsePlaywrightPort(value: string | undefined): number {
  if (value === undefined) return 3000;

  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65_535) {
    throw new Error("PLAYWRIGHT_PORT must be an integer between 1024 and 65535.");
  }

  return port;
}
