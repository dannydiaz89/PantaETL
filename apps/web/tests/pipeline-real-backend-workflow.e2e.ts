import { expect, test } from "@playwright/test";

import { en } from "../src/locales/en.js";
import { createRealBackendSession } from "./real-backend-session.js";

test("creates, configures, saves, and reloads a pipeline through the real API and database, with no pipeline mocking", async ({ browser, baseURL }) => {
  if (baseURL === undefined) {
    throw new Error("Playwright baseURL is required for a real-backend test.");
  }

  const session = await createRealBackendSession(browser, baseURL);

  try {
    const page = await session.context.newPage();
    await page.goto("/pipelines/new");
    await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");

    await page.getByLabel(en["pipeline.name"]).fill("Real backend orders sync");

    await page.getByRole("button", { name: en["components.sources.csv.name"] }).click();
    await page.getByLabel(en["components.sources.csv.sourcePath"]).fill("imports/orders.csv");

    await page.getByRole("button", { name: en["pipeline.builder.next"] }).click();
    await page.getByRole("button", { name: en["components.transforms.rows.limit.name"] }).click();
    await page.getByLabel(en["components.transforms.rows.limit.count"]).fill("100");

    await page.getByRole("button", { name: en["pipeline.builder.next"] }).click();
    await expect(page.getByText(en["pipeline.builder.readiness.incomplete"])).toBeVisible();

    await page.getByRole("button", { name: en["components.exports.json.name"] }).click();
    await page.getByLabel(en["components.exports.json.fileName"]).fill("orders.json");
    await expect(page.getByText(en["pipeline.builder.readiness.complete"])).toBeVisible();

    const saveButton = page.getByRole("button", { name: en["pipeline.builder.save"] });
    await expect(saveButton).toBeEnabled();
    const [createResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().endsWith("/api/pipelines") && response.request().method() === "POST"),
      saveButton.click(),
    ]);
    expect(createResponse.status()).toBe(201);
    await expect(page.locator(".pipeline-builder__save-error")).toHaveCount(0);

    await page.reload();
    await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
    await expect(page.getByLabel(en["pipeline.name"])).toHaveValue("Real backend orders sync");
    await expect(page.getByLabel(en["components.sources.csv.sourcePath"])).toHaveValue("imports/orders.csv");
    await expect(page.getByRole("button", { name: en["components.sources.csv.name"] })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: en["pipeline.builder.next"] }).click();
    await expect(page.getByLabel(en["components.transforms.rows.limit.count"])).toHaveValue("100");

    await page.getByRole("button", { name: en["pipeline.builder.next"] }).click();
    await expect(page.getByLabel(en["components.exports.json.fileName"])).toHaveValue("orders.json");
    await expect(page.getByRole("button", { name: en["components.exports.json.name"] })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(en["pipeline.builder.readiness.complete"])).toBeVisible();
  } finally {
    await session.cleanup();
    await session.context.close();
  }
});
