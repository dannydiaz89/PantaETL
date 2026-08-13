import { AxeBuilder } from "@axe-core/playwright";
import type { Pipeline } from "@pantaetl/contracts";
import { expect, test } from "@playwright/test";

import { en } from "../src/locales/en.js";

const pipeline: Pipeline = {
  contractVersion: "v1",
  createdAt: "2026-08-13T12:00:00.000Z",
  edges: [{ fromStepId: "833e4567-e89b-12d3-a456-426614174002", toStepId: "833e4567-e89b-12d3-a456-426614174003" }],
  id: "833e4567-e89b-12d3-a456-426614174001",
  name: "Daily order import",
  ownerUserId: "833e4567-e89b-12d3-a456-426614174004",
  state: "enabled",
  steps: [
    {
      componentType: "source.csv",
      componentVersion: "v1",
      configuration: { secretBindings: [], values: { path: "orders.csv" } },
      id: "833e4567-e89b-12d3-a456-426614174002",
      kind: "source",
    },
    {
      componentType: "export.json",
      componentVersion: "v1",
      configuration: { secretBindings: [], values: { path: "orders.json" } },
      id: "833e4567-e89b-12d3-a456-426614174003",
      kind: "export",
    },
  ],
  triggers: [],
  updatedAt: "2026-08-13T12:00:00.000Z",
};

test("pipeline actions use real endpoints, preserve draft edits on conflicts, and remain accessible", async ({ page }) => {
  const duplicate = { ...pipeline, id: "933e4567-e89b-12d3-a456-426614174001", name: "Daily order import copy", state: "draft" as const };
  let pipelines: readonly Pipeline[] = [pipeline];

  await page.route("**/api/pipelines**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (request.method() === "GET" && path === "/api/pipelines") {
      await route.fulfill({ body: JSON.stringify({ pipelines }), contentType: "application/json" });
      return;
    }
    if (request.method() === "GET" && path === `/api/pipelines/${pipeline.id}`) {
      await route.fulfill({ body: JSON.stringify(pipeline), contentType: "application/json" });
      return;
    }
    if (request.method() === "POST" && path === `/api/pipelines/${pipeline.id}/duplicate`) {
      pipelines = [...pipelines, duplicate];
      await route.fulfill({ body: JSON.stringify(duplicate), contentType: "application/json", status: 201 });
      return;
    }
    if (request.method() === "POST" && path === `/api/pipelines/${pipeline.id}/run`) {
      await route.fulfill({
        body: JSON.stringify({ initialJobCount: 1, pipelineId: pipeline.id, queuedBehindActiveRun: false, runId: "833e4567-e89b-12d3-a456-426614174005" }),
        contentType: "application/json",
      });
      return;
    }
    if (request.method() === "POST" && path === `/api/pipelines/${pipeline.id}/disable`) {
      await route.fulfill({ body: JSON.stringify({ code: "pipeline_locked" }), contentType: "application/json", status: 409 });
      return;
    }

    await route.fallback();
  });

  await page.goto("/pipelines");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.getByLabel(en["pipeline.name"]).fill("Unsaved orders");
  await page.getByRole("tab", { name: en["pipeline.tab.settings"] }).click();

  await page.getByRole("button", { name: en["pipeline.actions.duplicate"] }).click({ noWaitAfter: true });
  await expect(page.getByText(en["pipeline.actions.duplicateSuccess"])).toBeVisible();
  await page.reload();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.getByLabel(en["pipeline.name"]).fill("Unsaved orders");
  await page.getByRole("tab", { name: en["pipeline.tab.settings"] }).click();
  await page.getByRole("button", { name: en["pipeline.actions.run"] }).click({ noWaitAfter: true });
  await expect(page.getByText(en["pipeline.actions.runSuccess"])).toBeVisible();
  await page.reload();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.getByLabel(en["pipeline.name"]).fill("Unsaved orders");
  await page.getByRole("tab", { name: en["pipeline.tab.settings"] }).click();
  await page.getByRole("button", { name: en["pipeline.actions.disable"] }).click({ noWaitAfter: true });
  await expect(page.getByRole("alert")).toHaveText(en["pipeline.actions.error.locked"]);

  await page.getByRole("tab", { name: en["pipeline.tab.overview"] }).click();
  await expect(page.getByLabel(en["pipeline.name"])).toHaveValue("Unsaved orders");
  await page.getByRole("tab", { name: en["pipeline.tab.settings"] }).click();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});
