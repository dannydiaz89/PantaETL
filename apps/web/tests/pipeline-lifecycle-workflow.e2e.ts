import { randomUUID } from "node:crypto";

import { expect, test, type APIRequestContext } from "@playwright/test";

import { en } from "../src/locales/en.js";
import { createRealBackendSession } from "./real-backend-session.js";

/** Creates one complete, executable pipeline directly through the real control-plane API. */
async function createRealPipeline(request: APIRequestContext, baseUrl: string, name: string): Promise<string> {
  const sourceStepId = randomUUID();
  const exportStepId = randomUUID();
  const response = await request.post(`${baseUrl}/api/pipelines`, {
    data: {
      contractVersion: "v1",
      edges: [{ fromStepId: sourceStepId, toStepId: exportStepId }],
      name,
      steps: [
        {
          componentType: "source.csv",
          componentVersion: "v1",
          configuration: { secretBindings: [], values: { sourcePath: "imports/orders.csv" } },
          id: sourceStepId,
          kind: "source",
        },
        {
          componentType: "export.json",
          componentVersion: "v1",
          configuration: { secretBindings: [], values: { fileName: `${randomUUID()}.json` } },
          id: exportStepId,
          kind: "export",
        },
      ],
      triggers: [{ enabled: false, type: "manual" }],
    },
  });
  expect(response.status()).toBe(201);
  const pipeline: { id: string } = await response.json();
  return pipeline.id;
}

test("pipeline lifecycle actions use real endpoints against a genuine active-run lock, with no pipeline mocking", async ({ browser, baseURL }) => {
  if (baseURL === undefined) {
    throw new Error("Playwright baseURL is required for a real-backend test.");
  }

  const session = await createRealBackendSession(browser, baseURL);
  const { request } = session.context;

  try {
    const lifecyclePipelineId = await createRealPipeline(request, baseURL, "Lifecycle orders sync");
    const idlePipelineId = await createRealPipeline(request, baseURL, "Idle orders sync");

    const page = await session.context.newPage();
    await page.goto("/pipelines");
    await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
    await expect(page.locator(".pipeline-editor").getByLabel(en["pipeline.name"])).toHaveValue("Lifecycle orders sync");

    const enableResponse = await request.post(`${baseURL}/api/pipelines/${lifecyclePipelineId}/enable`);
    expect(enableResponse.status()).toBe(200);
    expect((await enableResponse.json()).state).toBe("enabled");

    await page.reload();
    await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
    await expect(page.locator(".pipeline-editor").getByText(en["pipeline.state.enabled"])).toBeVisible();

    const nameField = page.locator(".pipeline-editor").getByLabel(en["pipeline.name"]);
    await nameField.fill("Lifecycle orders sync (unsaved)");

    const runResponse = await request.post(`${baseURL}/api/pipelines/${lifecyclePipelineId}/run`);
    expect(runResponse.status()).toBe(200);
    const run: { initialJobCount: number; pipelineId: string; queuedBehindActiveRun: boolean; runId: string } = await runResponse.json();
    expect(run.pipelineId).toBe(lifecyclePipelineId);
    expect(run.queuedBehindActiveRun).toBe(false);
    expect(run.initialJobCount).toBeGreaterThan(0);

    // The client's execution-state cache is now stale (no active run), matching a real race
    // where another actor queues a run between page load and this save attempt.
    await expect(nameField).toHaveValue("Lifecycle orders sync (unsaved)");
    await page.getByRole("button", { name: en["pipeline.save"] }).dispatchEvent("click");
    await expect(page.getByRole("alert")).toContainText(en["pipeline.mutation.locked"]);
    await expect(nameField).toHaveValue("Lifecycle orders sync (unsaved)");

    await page.reload();
    await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
    await expect(page.locator(".pipeline-editor").getByLabel(en["pipeline.name"])).toBeDisabled();
    await expect(page.getByRole("button", { name: en["pipeline.save"] })).toBeDisabled();

    const duplicateResponse = await request.post(`${baseURL}/api/pipelines/${lifecyclePipelineId}/duplicate`);
    expect(duplicateResponse.status()).toBe(201);
    const duplicate: { id: string; name: string; state: string } = await duplicateResponse.json();
    expect(duplicate.id).not.toBe(lifecyclePipelineId);
    expect(duplicate.state).toBe("draft");

    const deleteResponse = await request.delete(`${baseURL}/api/pipelines/${idlePipelineId}`);
    expect(deleteResponse.status()).toBe(204);

    const listResponse = await request.get(`${baseURL}/api/pipelines`);
    const list: { pipelines: readonly { id: string }[] } = await listResponse.json();
    const listedIds = list.pipelines.map((pipeline) => pipeline.id);
    expect(listedIds).not.toContain(idlePipelineId);
    expect(listedIds).toContain(lifecyclePipelineId);
    expect(listedIds).toContain(duplicate.id);
  } finally {
    await session.cleanup();
    await session.context.close();
  }
});
