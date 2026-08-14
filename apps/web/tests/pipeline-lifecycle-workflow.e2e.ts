import { randomUUID } from "node:crypto";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

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

/** Enqueues a real run through the same endpoint the UI calls. */
async function enqueueRun(request: APIRequestContext, baseUrl: string, pipelineId: string): Promise<void> {
  const runResponse = await request.post(`${baseUrl}/api/pipelines/${pipelineId}/run`);
  expect(runResponse.status()).toBe(200);
  const run: { initialJobCount: number; pipelineId: string } = await runResponse.json();
  expect(run.pipelineId).toBe(pipelineId);
  expect(run.initialJobCount).toBeGreaterThan(0);
}

/**
 * Attempts to save a stale-but-unsaved edit while a real run is active and confirms the
 * server rejects it without discarding the edit.
 *
 * A worker attached to this deployment can claim and finish a trivial run before the save
 * request reaches the server, so this retries with a fresh run whenever the save
 * unexpectedly succeeds instead of hitting the real lock. Deployments with no worker at
 * all (queued runs never resolve) succeed on the first attempt.
 */
async function verifyConflictPreservesUnsavedEdit(
  page: Page,
  request: APIRequestContext,
  baseUrl: string,
  pipelineId: string,
): Promise<void> {
  const nameField = page.locator(".pipeline-editor").getByLabel(en["pipeline.name"]);
  const saveButton = page.getByRole("button", { name: en["pipeline.save"] });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const unsavedName = `Lifecycle orders sync (unsaved ${attempt})`;
    await nameField.fill(unsavedName);
    await enqueueRun(request, baseUrl, pipelineId);

    const [patchResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().endsWith(`/api/pipelines/${pipelineId}`) && response.request().method() === "PATCH"),
      saveButton.dispatchEvent("click"),
    ]);

    if (patchResponse.status() === 409) {
      await expect(page.getByRole("alert")).toContainText(en["pipeline.mutation.locked"]);
      await expect(nameField).toHaveValue(unsavedName);
      return;
    }

    // The save succeeded because the run already finished before the request landed;
    // reload for a clean, editable pipeline before retrying with a fresh unsaved edit.
    expect(patchResponse.status()).toBe(200);
    await page.reload();
    await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  }

  throw new Error("A save attempt never raced a still-active run.");
}

/**
 * Confirms the pipeline editor reports the pipeline as locked after a reload, queuing a
 * fresh run only if the one already active has already resolved.
 *
 * A deployment with no worker attached leaves every queued run active forever, so the
 * lock from `verifyConflictPreservesUnsavedEdit`'s run is normally still in effect; a
 * worker that finished it already is handled by queuing and checking again.
 */
async function verifyPipelineIsLocked(
  page: Page,
  request: APIRequestContext,
  baseUrl: string,
  pipelineId: string,
): Promise<void> {
  const nameField = page.locator(".pipeline-editor").getByLabel(en["pipeline.name"]);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.reload();
    await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
    if (await nameField.isDisabled()) return;

    await enqueueRun(request, baseUrl, pipelineId);
  }

  throw new Error("The pipeline never appeared locked after queuing a run.");
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

    await verifyConflictPreservesUnsavedEdit(page, request, baseURL, lifecyclePipelineId);
    await verifyPipelineIsLocked(page, request, baseURL, lifecyclePipelineId);
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
