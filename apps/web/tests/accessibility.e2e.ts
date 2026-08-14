import { AxeBuilder } from "@axe-core/playwright";
import {
  pipelineCreateResponseSchema,
  type ComponentMetadata,
  type Pipeline,
  type PipelineCreateRequest,
} from "@pantaetl/contracts";
import { expect, test, type Page } from "@playwright/test";

import { en } from "../src/locales/en.js";
import { LOCALE_STORAGE_KEY } from "../src/locale-provider.js";

/** Fails with the selector, rule, and remediation URL for each detected violation. */
async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  if (results.violations.length > 0) {
    throw new Error(results.violations.map((violation) => [
      `${violation.id}: ${violation.help}`,
      violation.helpUrl,
      ...violation.nodes.map((node) => `  ${node.target.join(", ")}: ${node.failureSummary ?? "inspect this element"}`),
    ].join("\n")).join("\n\n"));
  }
}

/** Waits for client event handlers before exercising interactive controls. */
async function waitForApplication(page: Page) {
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
}

/** Applies a PATCH body over a mocked pipeline, assigning fresh ids to any replaced triggers as the real API would. */
function applyPipelinePatch(pipeline: Pipeline, body: Record<string, unknown>): Pipeline {
  const triggers = Array.isArray(body.triggers)
    ? (body.triggers as readonly Omit<Pipeline["triggers"][number], "id" | "pipelineId">[]).map((trigger) => ({
      ...trigger,
      id: globalThis.crypto.randomUUID(),
      pipelineId: pipeline.id,
    })) as Pipeline["triggers"]
    : pipeline.triggers;

  return { ...pipeline, ...body, triggers };
}

test("uses the persisted locale for the document language", async ({ page }) => {
  await page.addInitScript((storageKey) => window.localStorage.setItem(storageKey, "en-GB"), LOCALE_STORAGE_KEY);
  await page.goto("/");
  await waitForApplication(page);

  await expect(page.locator("html")).toHaveAttribute("lang", "en-GB");
});

test("navigation is keyboard reachable and has no WCAG A/AA violations", async ({ page }) => {
  await page.goto("/");
  await waitForApplication(page);
  const navigation = page.getByRole("navigation", { name: en["navigation.menu"] });
  const expectedLinks = [
    [en["navigation.overview"], "/"],
    [en["navigation.pipelines"], "/pipelines"],
    [en["navigation.runs"], "/runs"],
    [en["navigation.plugins"], "/plugins"],
    [en["navigation.system"], "/system"],
    [en["navigation.users"], "/users"],
  ] as const;

  for (const [label, href] of expectedLinks) {
    await expect(navigation.getByRole("link", { name: label })).toHaveAttribute("href", href);
  }

  const firstLink = navigation.getByRole("link", { name: en["navigation.overview"] });
  await firstLink.focus();
  await page.keyboard.press("Tab");
  await expect(navigation.getByRole("link", { name: en["navigation.pipelines"] })).toBeFocused();
  await expectNoAccessibilityViolations(page);
});

test("sidebar stays viewport-bound and collapses without removing navigation semantics", async ({ page }) => {
  await page.goto("/runs");
  await waitForApplication(page);
  const sidebar = page.locator(".app-sidebar");

  const dimensions = await sidebar.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    viewportHeight: window.innerHeight,
  }));
  expect(dimensions.height).toBe(dimensions.viewportHeight);

  await page.getByRole("button", { name: en["navigation.collapse"] }).click();
  await expect(sidebar).toHaveAttribute("data-collapsed", "true");
  await expect(page.getByRole("button", { name: en["navigation.expand"] })).toBeVisible();
  await expect(page.getByRole("navigation", { name: en["navigation.menu"] }).getByRole("link", { name: en["navigation.pipelines"] })).toBeVisible();
  await expectNoAccessibilityViolations(page);
});

test("login form and account dialog meet the accessibility baseline", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel(en["login.email"])).toBeVisible();
  await expect(page.getByLabel(en["login.password"])).toBeVisible();
  await expectNoAccessibilityViolations(page);

  await page.goto("/");
  await waitForApplication(page);
  await page.getByRole("button", { name: en["account.menu"] }).click();
  await expect(page.getByRole("dialog", { name: en["account.title"] })).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("pipeline editor loads a persisted pipeline through accessible query states", async ({ page }) => {
  await page.route("**/api/pipelines**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== "GET" || (path !== "/api/pipelines" && path !== `/api/pipelines/${persistedPipeline.id}`)) {
      await route.fallback();
      return;
    }

    await route.fulfill({
      body: JSON.stringify(path === "/api/pipelines" ? { pipelines: [persistedPipeline] } : persistedPipeline),
      contentType: "application/json",
    });
  });
  await page.goto("/pipelines");
  await waitForApplication(page);
  await expect(page.locator(".pipeline-workspace")).toHaveAttribute("data-hydrated", "true");
  const nameInput = page.locator(".pipeline-editor").getByLabel(en["pipeline.name"]);

  await expect(nameInput).toBeEnabled();
  await page.getByRole("tab", { name: en["pipeline.tab.trigger"] }).click();
  await expect(page.getByText(en["pipeline.trigger.description"])).toBeVisible();
  await expectNoAccessibilityViolations(page);
});

test("pipeline collection announces loading and gives an empty workspace a focused creation path", async ({ page }) => {
  let releaseListResponse!: () => void;
  const listResponse = new Promise<void>((resolve) => {
    releaseListResponse = resolve;
  });

  await page.route("**/api/pipelines", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await listResponse;
    await route.fulfill({ body: JSON.stringify({ pipelines: [] }), contentType: "application/json" });
  });
  const listRequest = page.waitForRequest((request) => request.method() === "GET" && new URL(request.url()).pathname === "/api/pipelines");
  await page.goto("/pipelines");
  await waitForApplication(page);
  await listRequest;

  const loadingState = page.locator(".ui-data-table__state[role='status']");
  await expect(loadingState).toHaveText(en["pipeline.table.loading"]);
  await expect(loadingState).toHaveAttribute("aria-busy", "true");
  releaseListResponse();

  await expect(page.getByText(en["pipeline.table.emptyDescription"])).toBeVisible();
  await page.getByRole("link", { name: en["pipeline.create.open"] }).click();
  await expect(page).toHaveURL(/\/pipelines\/new$/);
  await expect(page.getByLabel(en["pipeline.name"])).toBeVisible();
  await expectNoAccessibilityViolations(page);
});

test("pipeline collection errors are announced and can be retried", async ({ page }) => {
  let shouldFail = true;
  let listRequestCount = 0;

  await page.route("**/api/pipelines", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    listRequestCount += 1;
    await route.fulfill(shouldFail
      ? { body: JSON.stringify({ code: "unknown_error" }), contentType: "application/json", status: 503 }
      : { body: JSON.stringify({ pipelines: [] }), contentType: "application/json" });
  });
  await page.goto("/pipelines");
  await waitForApplication(page);
  await expect.poll(() => listRequestCount).toBe(1);

  const errorState = page.getByRole("alert");
  await expect(errorState).toContainText(en["pipeline.table.error"]);
  shouldFail = false;
  await errorState.getByRole("button", { name: en["pipeline.retry"] }).click();
  await expect.poll(() => listRequestCount).toBe(2);
  await expect(page.getByText(en["pipeline.table.emptyDescription"])).toBeVisible();
  await expectNoAccessibilityViolations(page);
});

test("pipeline name updates use the control-plane API and announce completion", async ({ page }) => {
  let pipeline = persistedPipeline;

  await page.route("**/api/pipelines**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/pipelines" && request.method() === "GET") {
      await route.fulfill({ body: JSON.stringify({ pipelines: [pipeline] }), contentType: "application/json" });
      return;
    }
    if (path === `/api/pipelines/${pipeline.id}` && request.method() === "GET") {
      await route.fulfill({ body: JSON.stringify(pipeline), contentType: "application/json" });
      return;
    }
    if (path === `/api/pipelines/${pipeline.id}` && request.method() === "PATCH") {
      pipeline = applyPipelinePatch(pipeline, request.postDataJSON() as Record<string, unknown>);
      await route.fulfill({ body: JSON.stringify(pipeline), contentType: "application/json" });
      return;
    }
    await route.fallback();
  });

  await page.goto("/pipelines");
  await waitForApplication(page);
  const nameInput = page.locator(".pipeline-editor").getByLabel(en["pipeline.name"]);
  await nameInput.fill("Updated persisted orders");
  await page.getByRole("button", { name: en["pipeline.save"] }).click();
  await expect(page.getByText(en["pipeline.saveSuccess"])).toBeVisible();
  await expectNoAccessibilityViolations(page);
});

test("pipeline update conflicts are announced without exposing backend details", async ({ page }) => {
  await page.route("**/api/pipelines**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/pipelines" && request.method() === "GET") {
      await route.fulfill({ body: JSON.stringify({ pipelines: [persistedPipeline] }), contentType: "application/json" });
      return;
    }
    if (path === `/api/pipelines/${persistedPipeline.id}` && request.method() === "GET") {
      await route.fulfill({ body: JSON.stringify(persistedPipeline), contentType: "application/json" });
      return;
    }
    if (path === `/api/pipelines/${persistedPipeline.id}` && request.method() === "PATCH") {
      await route.fulfill({ body: JSON.stringify({ code: "pipeline_locked" }), contentType: "application/json", status: 409 });
      return;
    }
    await route.fallback();
  });

  await page.goto("/pipelines");
  await waitForApplication(page);
  await page.locator(".pipeline-editor").getByLabel(en["pipeline.name"]).fill("Blocked update");
  await page.getByRole("button", { name: en["pipeline.save"] }).click();
  await expect(page.getByRole("alert")).toContainText(en["pipeline.mutation.locked"]);
  await expect(page.locator(".pipeline-editor").getByLabel(en["pipeline.name"])).toHaveValue("Blocked update");
  await expectNoAccessibilityViolations(page);
});

test("pipeline editor reuses the wizard's Source, Transforms, and Export editors for an idle pipeline", async ({ page }) => {
  const csvSource: ComponentMetadata = {
    configFields: [{ key: "path", labelKey: "components.sources.csv.sourcePath", required: true, secret: false, type: "text" }],
    descriptionKey: "components.sources.csv.description",
    displayNameKey: "components.sources.csv.name",
    inputFamilies: [],
    kind: "source",
    outputFamilies: ["tabular"],
    type: "source.csv",
    version: "v1",
  };
  const limitTransform: ComponentMetadata = {
    configFields: [{ key: "count", labelKey: "components.transforms.rows.limit.count", required: true, secret: false, type: "number" }],
    descriptionKey: "components.transforms.rows.limit.description",
    displayNameKey: "components.transforms.rows.limit.name",
    inputFamilies: ["tabular"],
    kind: "transform",
    outputFamilies: ["tabular"],
    type: "transform.limit",
    version: "v1",
  };
  const jsonExport: ComponentMetadata = {
    configFields: [{ key: "fileName", labelKey: "components.exports.json.fileName", required: true, secret: false, type: "text" }],
    descriptionKey: "components.exports.json.description",
    displayNameKey: "components.exports.json.name",
    inputFamilies: ["tabular"],
    kind: "export",
    outputFamilies: [],
    type: "export.json",
    version: "v1",
  };
  let pipeline: Pipeline = {
    contractVersion: "v1",
    createdAt: "2026-08-13T12:00:00.000Z",
    edges: [
      { fromStepId: "c33e4567-e89b-12d3-a456-426614174002", toStepId: "c33e4567-e89b-12d3-a456-426614174005" },
      { fromStepId: "c33e4567-e89b-12d3-a456-426614174005", toStepId: "c33e4567-e89b-12d3-a456-426614174003" },
    ],
    id: "c33e4567-e89b-12d3-a456-426614174001",
    name: "Idle pipeline",
    ownerUserId: "c33e4567-e89b-12d3-a456-426614174004",
    state: "enabled",
    steps: [
      {
        componentType: "source.csv",
        componentVersion: "v1",
        configuration: { secretBindings: [], values: { path: "orders.csv" } },
        id: "c33e4567-e89b-12d3-a456-426614174002",
        kind: "source",
      },
      {
        componentType: "export.json",
        componentVersion: "v1",
        configuration: { secretBindings: [], values: { fileName: "orders.json" } },
        id: "c33e4567-e89b-12d3-a456-426614174003",
        kind: "export",
      },
      {
        componentType: "transform.limit",
        componentVersion: "v1",
        configuration: { secretBindings: [], values: { count: 50 } },
        id: "c33e4567-e89b-12d3-a456-426614174005",
        kind: "transform",
      },
    ],
    triggers: [],
    updatedAt: "2026-08-13T12:00:00.000Z",
  };
  let updateCount = 0;

  await page.route("**/api/components**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path !== "/api/components") {
      await route.fallback();
      return;
    }
    await route.fulfill({ body: JSON.stringify({ components: [csvSource, limitTransform, jsonExport] }), contentType: "application/json" });
  });

  await page.route("**/api/pipelines**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/pipelines" && request.method() === "GET") {
      await route.fulfill({ body: JSON.stringify({ pipelines: [pipeline] }), contentType: "application/json" });
      return;
    }
    if (path === `/api/pipelines/${pipeline.id}` && request.method() === "GET") {
      await route.fulfill({ body: JSON.stringify(pipeline), contentType: "application/json" });
      return;
    }
    if (path === `/api/pipelines/${pipeline.id}` && request.method() === "PATCH") {
      updateCount += 1;
      pipeline = applyPipelinePatch(pipeline, { ...(request.postDataJSON() as object), updatedAt: "2026-08-13T13:00:00.000Z" });
      await route.fulfill({ body: JSON.stringify(pipeline), contentType: "application/json" });
      return;
    }
    await route.fallback();
  });

  await page.goto("/pipelines");
  await waitForApplication(page);

  await page.getByRole("tab", { name: en["pipeline.tab.source"] }).click();
  const sourceButton = page.getByRole("button", { name: en["components.sources.csv.name"] });
  await expect(sourceButton).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel(en["components.sources.csv.sourcePath"]).fill("imports/orders-v2.csv");

  await page.getByRole("tab", { name: en["pipeline.tab.transforms"] }).click();
  const transformList = page.locator(".pipeline-builder-transforms__list");
  await expect(transformList.getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", { name: en["components.transforms.rows.limit.name"] }).click();
  await expect(transformList.getByRole("listitem")).toHaveCount(2);

  await page.getByRole("tab", { name: en["pipeline.tab.export"] }).click();
  await expect(page.getByRole("button", { name: en["components.exports.json.name"] })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel(en["components.exports.json.fileName"]).fill("orders-v2.json");

  await page.getByRole("tab", { name: en["pipeline.tab.overview"] }).click();
  await page.getByRole("button", { name: en["pipeline.save"] }).click();
  await expect(page.getByText(en["pipeline.saveSuccess"])).toBeVisible();
  expect(updateCount).toBe(1);
  expect(pipeline.steps.find((step) => step.kind === "source")?.configuration.values.path).toBe("imports/orders-v2.csv");
  expect(pipeline.steps.find((step) => step.kind === "export")?.configuration.values.fileName).toBe("orders-v2.json");
  expect(pipeline.steps.filter((step) => step.kind === "transform")).toHaveLength(2);
  await expectNoAccessibilityViolations(page);
});

test("pipeline editor disables Transform and Export options incompatible with the current chain, with a reason", async ({ page }) => {
  const csvSource: ComponentMetadata = {
    configFields: [{ key: "path", labelKey: "components.sources.csv.sourcePath", required: true, secret: false, type: "text" }],
    descriptionKey: "components.sources.csv.description",
    displayNameKey: "components.sources.csv.name",
    inputFamilies: [],
    kind: "source",
    outputFamilies: ["tabular"],
    type: "source.csv",
    version: "v1",
  };
  const limitTransform: ComponentMetadata = {
    configFields: [],
    descriptionKey: "components.transforms.rows.limit.description",
    displayNameKey: "components.transforms.rows.limit.name",
    inputFamilies: ["tabular"],
    kind: "transform",
    outputFamilies: ["tabular"],
    type: "transform.limit",
    version: "v1",
  };
  const documentTransform: ComponentMetadata = {
    configFields: [],
    descriptionKey: "components.transforms.document.flatten.description",
    displayNameKey: "components.transforms.document.flatten.name",
    inputFamilies: ["document"],
    kind: "transform",
    outputFamilies: ["tabular"],
    type: "transform.document.flatten",
    version: "v1",
  };
  const jsonExport: ComponentMetadata = {
    configFields: [{ key: "fileName", labelKey: "components.exports.json.fileName", required: true, secret: false, type: "text" }],
    descriptionKey: "components.exports.json.description",
    displayNameKey: "components.exports.json.name",
    inputFamilies: ["tabular"],
    kind: "export",
    outputFamilies: [],
    type: "export.json",
    version: "v1",
  };
  const pipeline: Pipeline = {
    contractVersion: "v1",
    createdAt: "2026-08-13T12:00:00.000Z",
    edges: [{ fromStepId: "d33e4567-e89b-12d3-a456-426614174002", toStepId: "d33e4567-e89b-12d3-a456-426614174003" }],
    id: "d33e4567-e89b-12d3-a456-426614174001",
    name: "Idle pipeline",
    ownerUserId: "d33e4567-e89b-12d3-a456-426614174004",
    state: "enabled",
    steps: [
      {
        componentType: "source.csv",
        componentVersion: "v1",
        configuration: { secretBindings: [], values: { path: "orders.csv" } },
        id: "d33e4567-e89b-12d3-a456-426614174002",
        kind: "source",
      },
      {
        componentType: "export.json",
        componentVersion: "v1",
        configuration: { secretBindings: [], values: { fileName: "orders.json" } },
        id: "d33e4567-e89b-12d3-a456-426614174003",
        kind: "export",
      },
    ],
    triggers: [],
    updatedAt: "2026-08-13T12:00:00.000Z",
  };

  await page.route("**/api/components**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path !== "/api/components") {
      await route.fallback();
      return;
    }
    await route.fulfill({ body: JSON.stringify({ components: [csvSource, limitTransform, documentTransform, jsonExport] }), contentType: "application/json" });
  });

  await page.route("**/api/pipelines**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/pipelines" && request.method() === "GET") {
      await route.fulfill({ body: JSON.stringify({ pipelines: [pipeline] }), contentType: "application/json" });
      return;
    }
    if (path === `/api/pipelines/${pipeline.id}` && request.method() === "GET") {
      await route.fulfill({ body: JSON.stringify(pipeline), contentType: "application/json" });
      return;
    }
    await route.fallback();
  });

  await page.goto("/pipelines");
  await waitForApplication(page);

  await page.getByRole("tab", { name: en["pipeline.tab.transforms"] }).click();
  const incompatibleOption = page.getByRole("button", { name: en["components.transforms.document.flatten.name"] });
  await expect(incompatibleOption).toBeDisabled();
  await expect(page.getByText(en["pipeline.builder.compatibility.incompatible"])).toBeVisible();
  await expect(page.getByRole("button", { name: en["components.transforms.rows.limit.name"] })).toBeEnabled();
  await expectNoAccessibilityViolations(page);
});

test("pipeline editor edits manual and scheduled triggers with friendly controls and saves them through the canonical PATCH", async ({ page }) => {
  let pipeline: Pipeline = {
    contractVersion: "v1",
    createdAt: "2026-08-13T12:00:00.000Z",
    edges: [{ fromStepId: "133e4567-e89b-12d3-a456-426614174002", toStepId: "133e4567-e89b-12d3-a456-426614174003" }],
    id: "133e4567-e89b-12d3-a456-426614174001",
    name: "Idle pipeline",
    ownerUserId: "133e4567-e89b-12d3-a456-426614174004",
    state: "enabled",
    steps: [
      {
        componentType: "source.csv",
        componentVersion: "v1",
        configuration: { secretBindings: [], values: { path: "orders.csv" } },
        id: "133e4567-e89b-12d3-a456-426614174002",
        kind: "source",
      },
      {
        componentType: "export.json",
        componentVersion: "v1",
        configuration: { secretBindings: [], values: { fileName: "orders.json" } },
        id: "133e4567-e89b-12d3-a456-426614174003",
        kind: "export",
      },
    ],
    triggers: [
      { enabled: false, id: "133e4567-e89b-12d3-a456-426614174010", pipelineId: "133e4567-e89b-12d3-a456-426614174001", type: "manual" },
      {
        cron: "0 9 * * *",
        enabled: true,
        id: "133e4567-e89b-12d3-a456-426614174011",
        pipelineId: "133e4567-e89b-12d3-a456-426614174001",
        timezone: "UTC",
        type: "schedule",
      },
    ],
    updatedAt: "2026-08-13T12:00:00.000Z",
  };
  let updateCount = 0;

  await page.route("**/api/pipelines**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/pipelines" && request.method() === "GET") {
      await route.fulfill({ body: JSON.stringify({ pipelines: [pipeline] }), contentType: "application/json" });
      return;
    }
    if (path === `/api/pipelines/${pipeline.id}` && request.method() === "GET") {
      await route.fulfill({ body: JSON.stringify(pipeline), contentType: "application/json" });
      return;
    }
    if (path === `/api/pipelines/${pipeline.id}` && request.method() === "PATCH") {
      updateCount += 1;
      pipeline = applyPipelinePatch(pipeline, { ...(request.postDataJSON() as object), updatedAt: "2026-08-13T13:00:00.000Z" });
      await route.fulfill({ body: JSON.stringify(pipeline), contentType: "application/json" });
      return;
    }
    await route.fallback();
  });

  await page.goto("/pipelines");
  await waitForApplication(page);
  await page.getByRole("tab", { name: en["pipeline.tab.trigger"] }).click();

  const manualCheckbox = page.getByRole("checkbox", { name: en["pipeline.trigger.manual.label"] });
  await expect(manualCheckbox).not.toBeChecked();
  await manualCheckbox.click();
  await expect(manualCheckbox).toBeChecked();

  const scheduleItems = page.locator(".pipeline-trigger-editor__schedule");
  await expect(scheduleItems).toHaveCount(1);
  await expect(page.getByLabel(en["pipeline.trigger.hour.label"])).toHaveValue("9");
  await expect(page.getByLabel(en["pipeline.trigger.minute.label"])).toHaveValue("0");

  await page.getByRole("button", { name: en["pipeline.trigger.schedule.add"] }).click();
  await expect(scheduleItems).toHaveCount(2);

  await page.getByRole("button", { name: en["pipeline.trigger.schedule.remove"] }).first().click();
  await expect(scheduleItems).toHaveCount(1);

  await page.getByRole("tab", { name: en["pipeline.tab.overview"] }).click();
  await page.getByRole("button", { name: en["pipeline.save"] }).click();
  await expect(page.getByText(en["pipeline.saveSuccess"])).toBeVisible();

  expect(updateCount).toBe(1);
  const savedManual = pipeline.triggers.find((trigger) => trigger.type === "manual");
  expect(savedManual?.enabled).toBe(true);
  const savedSchedules = pipeline.triggers.filter((trigger) => trigger.type === "schedule");
  expect(savedSchedules).toHaveLength(1);
  expect(savedSchedules[0]).toMatchObject({ cron: "0 0 * * *", enabled: true });
  await expectNoAccessibilityViolations(page);
});

test("pipeline deletion keeps controls accessible and reconciles the workspace", async ({ page }) => {
  let pipelines: Pipeline[] = [persistedPipeline];
  const pipeline = persistedPipeline;

  await page.route("**/api/pipelines**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === "/api/pipelines" && request.method() === "GET") {
      await route.fulfill({ body: JSON.stringify({ pipelines }), contentType: "application/json" });
      return;
    }

    if (path === `/api/pipelines/${pipeline.id}` && request.method() === "GET") {
      await route.fulfill({ body: JSON.stringify(pipeline), contentType: "application/json" });
      return;
    }

    if (path === `/api/pipelines/${pipeline.id}` && request.method() === "DELETE") {
      pipelines = pipelines.filter((candidate) => candidate.id !== pipeline.id);
      await route.fulfill({ status: 204 });
      return;
    }

    await route.fallback();
  });

  await page.goto("/pipelines");
  await waitForApplication(page);
  await expect(page.getByRole("link", { name: en["pipeline.create.open"] })).toHaveAttribute("href", "/pipelines/new");
  await expect(page.locator(".pipeline-editor").getByLabel(en["pipeline.name"])).toHaveValue(persistedPipeline.name);

  const deleteTrigger = page.getByRole("button", { name: en["pipeline.delete.open"] });
  await deleteTrigger.dispatchEvent("click");
  const deleteConfirmation = page.getByRole("alertdialog", { name: en["pipeline.delete.title"] });
  await deleteConfirmation.getByRole("button", { name: en["pipeline.delete.confirm"] }).dispatchEvent("click");
  await expect(deleteConfirmation).toBeHidden();
  await expect(page.getByText(en["pipeline.table.empty"])).toBeVisible();
  await expectNoAccessibilityViolations(page);
});

test("pipeline creation wizard keeps the collected name across steps and announces progress accessibly", async ({ page }) => {
  await page.goto("/pipelines/new");
  await waitForApplication(page);

  const steps = page.getByRole("list", { name: en["pipeline.builder.progressLabel"] }).getByRole("listitem");
  await expect(steps).toHaveCount(3);
  await expect(steps.first()).toContainText(en["pipeline.builder.step.source.label"]);
  await expect(page.getByRole("button", { name: en["pipeline.builder.back"] })).toHaveCount(0);

  await page.getByLabel(en["pipeline.name"]).fill("Orders sync");
  await page.getByRole("button", { name: en["pipeline.builder.next"] }).click();
  await expect(steps.first()).toContainText(en["pipeline.builder.status.completed"]);

  await page.getByRole("button", { name: en["pipeline.builder.back"] }).click();
  await expect(page.getByLabel(en["pipeline.name"])).toHaveValue("Orders sync");
  await expectNoAccessibilityViolations(page);
});

test("pipeline creation wizard selects a Source from the capability catalog and configures it accessibly", async ({ page }) => {
  const csvSource: ComponentMetadata = {
    configFields: [{ key: "path", labelKey: "components.sources.csv.sourcePath", required: true, secret: false, type: "text" }],
    descriptionKey: "components.sources.csv.description",
    displayNameKey: "components.sources.csv.name",
    inputFamilies: [],
    kind: "source",
    outputFamilies: ["tabular"],
    type: "source.csv",
    version: "v1",
  };

  await page.route("**/api/components**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path !== "/api/components") {
      await route.fallback();
      return;
    }
    await route.fulfill({ body: JSON.stringify({ components: [csvSource] }), contentType: "application/json" });
  });

  await page.goto("/pipelines/new");
  await waitForApplication(page);

  await page.getByRole("button", { name: en["components.sources.csv.name"] }).click();
  const configurationField = page.getByLabel(en["components.sources.csv.sourcePath"]);
  await expect(configurationField).toBeVisible();
  await configurationField.fill("imports/orders.csv");
  await expect(page.getByRole("button", { name: en["components.sources.csv.name"] })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: en["pipeline.builder.next"] }).click();
  await page.getByRole("button", { name: en["pipeline.builder.back"] }).click();
  await expect(configurationField).toHaveValue("imports/orders.csv");
  await expectNoAccessibilityViolations(page);
});

test("pipeline creation wizard adds, configures, reorders, and removes Transforms accessibly", async ({ page }) => {
  const limitTransform: ComponentMetadata = {
    configFields: [{ key: "count", labelKey: "components.transforms.rows.limit.count", required: true, secret: false, type: "number" }],
    descriptionKey: "components.transforms.rows.limit.description",
    displayNameKey: "components.transforms.rows.limit.name",
    inputFamilies: ["tabular"],
    kind: "transform",
    outputFamilies: ["tabular"],
    type: "transform.limit",
    version: "v1",
  };
  const fillNullTransform: ComponentMetadata = {
    configFields: [
      { key: "column", labelKey: "components.transforms.values.fillNull.column", required: true, secret: false, type: "text" },
      { key: "value", labelKey: "components.transforms.values.fillNull.value", required: true, secret: false, type: "text" },
    ],
    descriptionKey: "components.transforms.values.fillNull.description",
    displayNameKey: "components.transforms.values.fillNull.name",
    inputFamilies: ["tabular"],
    kind: "transform",
    outputFamilies: ["tabular"],
    type: "transform.values.fill-null",
    version: "v1",
  };

  await page.route("**/api/components**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path !== "/api/components") {
      await route.fallback();
      return;
    }
    await route.fulfill({ body: JSON.stringify({ components: [limitTransform, fillNullTransform] }), contentType: "application/json" });
  });

  await page.goto("/pipelines/new");
  await waitForApplication(page);
  await page.getByRole("button", { name: en["pipeline.builder.next"] }).click();
  await expect(page.getByText(en["pipeline.builder.transform.empty"])).toBeVisible();

  const transformList = page.locator(".pipeline-builder-transforms__list");
  await page.getByRole("button", { name: en["components.transforms.rows.limit.name"] }).click();
  await page.getByRole("button", { name: en["components.transforms.values.fillNull.name"] }).click();
  await expect(transformList.getByRole("listitem")).toHaveCount(2);
  await expect(transformList.getByRole("listitem").first()).toContainText(en["components.transforms.rows.limit.name"]);

  await transformList.getByLabel(en["components.transforms.rows.limit.count"]).fill("100");

  await transformList.getByRole("listitem").last().getByRole("button", { name: en["pipeline.builder.transform.moveUp"] }).click();
  await expect(transformList.getByRole("listitem").first()).toContainText(en["components.transforms.values.fillNull.name"]);
  await expect(transformList.getByLabel(en["components.transforms.rows.limit.count"])).toHaveValue("100");

  await transformList.getByRole("listitem").first().getByRole("button", { name: en["pipeline.builder.transform.remove"] }).click();
  await expect(transformList.getByRole("listitem")).toHaveCount(1);
  await expect(transformList.getByRole("listitem").first()).toContainText(en["components.transforms.rows.limit.name"]);
  await expectNoAccessibilityViolations(page);
});

test("pipeline creation wizard selects an Export and reports draft readiness once Source and Export are both chosen", async ({ page }) => {
  const csvSource: ComponentMetadata = {
    configFields: [{ key: "path", labelKey: "components.sources.csv.sourcePath", required: true, secret: false, type: "text" }],
    descriptionKey: "components.sources.csv.description",
    displayNameKey: "components.sources.csv.name",
    inputFamilies: [],
    kind: "source",
    outputFamilies: ["tabular"],
    type: "source.csv",
    version: "v1",
  };
  const jsonExport: ComponentMetadata = {
    configFields: [{ key: "fileName", labelKey: "components.exports.json.fileName", required: true, secret: false, type: "text" }],
    descriptionKey: "components.exports.json.description",
    displayNameKey: "components.exports.json.name",
    inputFamilies: ["tabular"],
    kind: "export",
    outputFamilies: [],
    type: "export.json",
    version: "v1",
  };

  await page.route("**/api/components**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path !== "/api/components") {
      await route.fallback();
      return;
    }
    await route.fulfill({ body: JSON.stringify({ components: [csvSource, jsonExport] }), contentType: "application/json" });
  });

  await page.goto("/pipelines/new");
  await waitForApplication(page);
  await page.getByRole("button", { name: en["components.sources.csv.name"] }).click();
  await page.getByLabel(en["components.sources.csv.sourcePath"]).fill("imports/orders.csv");

  await page.getByRole("button", { name: en["pipeline.builder.next"] }).click();
  await page.getByRole("button", { name: en["pipeline.builder.next"] }).click();
  await expect(page.getByText(en["pipeline.builder.readiness.incomplete"])).toBeVisible();

  await page.getByRole("button", { name: en["components.exports.json.name"] }).click();
  const configurationField = page.getByLabel(en["components.exports.json.fileName"]);
  await configurationField.fill("orders.json");
  await expect(page.getByText(en["pipeline.builder.readiness.complete"])).toBeVisible();

  await page.getByRole("button", { name: en["pipeline.builder.back"] }).click();
  await page.getByRole("button", { name: en["pipeline.builder.back"] }).click();
  await expect(page.getByLabel(en["components.sources.csv.sourcePath"])).toHaveValue("imports/orders.csv");
  await expectNoAccessibilityViolations(page);
});

test("pipeline creation wizard saves an incomplete draft through the real API, then resumes it after a reload", async ({ page }) => {
  const csvSource: ComponentMetadata = {
    configFields: [{ key: "path", labelKey: "components.sources.csv.sourcePath", required: true, secret: false, type: "text" }],
    descriptionKey: "components.sources.csv.description",
    displayNameKey: "components.sources.csv.name",
    inputFamilies: [],
    kind: "source",
    outputFamilies: ["tabular"],
    type: "source.csv",
    version: "v1",
  };
  const pipelineId = "a33e4567-e89b-12d3-a456-426614174099";
  let stored: Pipeline | undefined;
  let createCount = 0;
  let updateCount = 0;

  await page.route("**/api/components**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path !== "/api/components") {
      await route.fallback();
      return;
    }
    await route.fulfill({ body: JSON.stringify({ components: [csvSource] }), contentType: "application/json" });
  });

  await page.route("**/api/pipelines**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === "/api/pipelines" && request.method() === "POST") {
      createCount += 1;
      const body = request.postDataJSON() as PipelineCreateRequest;
      stored = pipelineCreateResponseSchema.parse({
        ...body,
        createdAt: "2026-08-13T12:00:00.000Z",
        id: pipelineId,
        ownerUserId: "a33e4567-e89b-12d3-a456-426614174000",
        state: "draft",
        triggers: body.triggers.map((trigger, index) => ({
          ...trigger,
          id: `a33e4567-e89b-12d3-a456-42661417409${index + 1}`,
          pipelineId,
        })),
        updatedAt: "2026-08-13T12:00:00.000Z",
      });
      await route.fulfill({ body: JSON.stringify(stored), contentType: "application/json", status: 201 });
      return;
    }

    if (path === `/api/pipelines/${pipelineId}` && request.method() === "PATCH" && stored !== undefined) {
      updateCount += 1;
      stored = { ...stored, ...(request.postDataJSON() as object), updatedAt: "2026-08-13T12:30:00.000Z" };
      await route.fulfill({ body: JSON.stringify(stored), contentType: "application/json" });
      return;
    }

    if (path === `/api/pipelines/${pipelineId}` && request.method() === "GET" && stored !== undefined) {
      await route.fulfill({ body: JSON.stringify(stored), contentType: "application/json" });
      return;
    }

    await route.fallback();
  });

  await page.goto("/pipelines/new");
  await waitForApplication(page);
  await page.getByLabel(en["pipeline.name"]).fill("Orders sync");
  await page.getByRole("button", { name: en["components.sources.csv.name"] }).click();
  await page.getByLabel(en["components.sources.csv.sourcePath"]).fill("imports/orders.csv");

  const saveButton = page.getByRole("button", { name: en["pipeline.builder.save"] });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await expect.poll(() => createCount).toBe(1);
  await expect(saveButton).toBeEnabled();

  await page.getByLabel(en["components.sources.csv.sourcePath"]).fill("imports/orders-v2.csv");
  await saveButton.click();
  await expect.poll(() => updateCount).toBe(1);
  expect(createCount).toBe(1);
  await expectNoAccessibilityViolations(page);

  await page.reload();
  await waitForApplication(page);
  await expect(page.getByLabel(en["pipeline.name"])).toHaveValue("Orders sync");
  await expect(page.getByLabel(en["components.sources.csv.sourcePath"])).toHaveValue("imports/orders-v2.csv");
  await expectNoAccessibilityViolations(page);
});

test("pipeline creation wizard preserves unsaved input and allows retry after a lock conflict", async ({ page }) => {
  const csvSource: ComponentMetadata = {
    configFields: [{ key: "path", labelKey: "components.sources.csv.sourcePath", required: true, secret: false, type: "text" }],
    descriptionKey: "components.sources.csv.description",
    displayNameKey: "components.sources.csv.name",
    inputFamilies: [],
    kind: "source",
    outputFamilies: ["tabular"],
    type: "source.csv",
    version: "v1",
  };
  let createAttempts = 0;

  await page.route("**/api/components**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path !== "/api/components") {
      await route.fallback();
      return;
    }
    await route.fulfill({ body: JSON.stringify({ components: [csvSource] }), contentType: "application/json" });
  });

  await page.route("**/api/pipelines", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    createAttempts += 1;
    if (createAttempts === 1) {
      await route.fulfill({ body: JSON.stringify({ code: "pipeline_locked" }), contentType: "application/json", status: 409 });
      return;
    }
    const body = route.request().postDataJSON() as PipelineCreateRequest;
    const pipeline = pipelineCreateResponseSchema.parse({
      ...body,
      createdAt: "2026-08-13T12:00:00.000Z",
      id: "e33e4567-e89b-12d3-a456-426614174099",
      ownerUserId: "e33e4567-e89b-12d3-a456-426614174000",
      state: "draft",
      triggers: body.triggers.map((trigger, index) => ({
        ...trigger,
        id: `e33e4567-e89b-12d3-a456-42661417409${index + 1}`,
        pipelineId: "e33e4567-e89b-12d3-a456-426614174099",
      })),
      updatedAt: "2026-08-13T12:00:00.000Z",
    });
    await route.fulfill({ body: JSON.stringify(pipeline), contentType: "application/json", status: 201 });
  });

  await page.goto("/pipelines/new");
  await waitForApplication(page);
  await page.getByLabel(en["pipeline.name"]).fill("Orders sync");
  await page.getByRole("button", { name: en["components.sources.csv.name"] }).click();
  await page.getByLabel(en["components.sources.csv.sourcePath"]).fill("imports/orders.csv");

  const saveButton = page.getByRole("button", { name: en["pipeline.builder.save"] });
  await saveButton.click();
  await expect(page.getByRole("alert")).toContainText(en["pipeline.mutation.locked"]);
  await expect(page.getByLabel(en["pipeline.name"])).toHaveValue("Orders sync");
  await expect(page.getByLabel(en["components.sources.csv.sourcePath"])).toHaveValue("imports/orders.csv");
  await expect(saveButton).toBeEnabled();

  await saveButton.click();
  await expect.poll(() => createAttempts).toBe(2);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expectNoAccessibilityViolations(page);
});

test("pipeline creation wizard ignores a duplicate Save click while a save is already in flight", async ({ page }) => {
  const csvSource: ComponentMetadata = {
    configFields: [{ key: "path", labelKey: "components.sources.csv.sourcePath", required: true, secret: false, type: "text" }],
    descriptionKey: "components.sources.csv.description",
    displayNameKey: "components.sources.csv.name",
    inputFamilies: [],
    kind: "source",
    outputFamilies: ["tabular"],
    type: "source.csv",
    version: "v1",
  };
  let createRequestCount = 0;

  await page.route("**/api/components**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path !== "/api/components") {
      await route.fallback();
      return;
    }
    await route.fulfill({ body: JSON.stringify({ components: [csvSource] }), contentType: "application/json" });
  });

  await page.route("**/api/pipelines", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    createRequestCount += 1;
    await new Promise((resolve) => { setTimeout(resolve, 300); });
    const body = route.request().postDataJSON() as PipelineCreateRequest;
    const pipeline = pipelineCreateResponseSchema.parse({
      ...body,
      createdAt: "2026-08-13T12:00:00.000Z",
      id: "f33e4567-e89b-12d3-a456-426614174099",
      ownerUserId: "f33e4567-e89b-12d3-a456-426614174000",
      state: "draft",
      triggers: body.triggers.map((trigger, index) => ({
        ...trigger,
        id: `f33e4567-e89b-12d3-a456-42661417409${index + 1}`,
        pipelineId: "f33e4567-e89b-12d3-a456-426614174099",
      })),
      updatedAt: "2026-08-13T12:00:00.000Z",
    });
    await route.fulfill({ body: JSON.stringify(pipeline), contentType: "application/json", status: 201 });
  });

  await page.goto("/pipelines/new");
  await waitForApplication(page);
  await page.getByLabel(en["pipeline.name"]).fill("Orders sync");
  await page.getByRole("button", { name: en["components.sources.csv.name"] }).click();
  await page.getByLabel(en["components.sources.csv.sourcePath"]).fill("imports/orders.csv");

  const saveButton = page.getByRole("button", { name: en["pipeline.builder.save"] });
  await saveButton.dispatchEvent("click");
  await saveButton.dispatchEvent("click");
  await saveButton.dispatchEvent("click");
  await expect.poll(() => createRequestCount, { timeout: 5_000 }).toBeGreaterThan(0);
  await expect(saveButton).toBeEnabled();
  expect(createRequestCount).toBe(1);
});

test("run history shows safe metadata in accessible tables", async ({ page }) => {
  await page.goto("/runs");
  await waitForApplication(page);
  await expect(page.getByText(en["runs.metric.recordsRead"], { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("artifacts/");
  await page.getByRole("button", { exact: true, name: en["runs.view"] }).nth(1).click();
  await expect(page.locator(".run-details").getByText(en["runs.status.running"], { exact: true }).first()).toBeVisible();
  await expectNoAccessibilityViolations(page);
});

test("system status presents safe application health accessibly", async ({ page }) => {
  await page.route("**/api/system/health", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        checkedAt: "2026-08-13T12:00:00.000Z",
        database: { status: "healthy" },
        garbageCollector: { status: "healthy" },
        queue: { queuedJobs: 4, runningJobs: 2, status: "healthy" },
        scheduler: { status: "healthy" },
        status: "healthy",
        storage: { status: "healthy" },
        workers: { status: "healthy" },
      }),
    });
  });
  await page.goto("/system");
  await waitForApplication(page);

  await expect(page.getByRole("heading", { name: en["system.health.title"] })).toBeVisible();
  await expect(page.getByText(en["system.component.database"], { exact: true })).toBeVisible();
  await expect(page.getByText(en["system.queue.queued"], { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/host|container|cpu|memory|disk/i);
  await expectNoAccessibilityViolations(page);
});

test("settings retains an accessible administrator boundary", async ({ page }) => {
  await page.goto("/settings");
  await waitForApplication(page);

  await expect(page.getByRole("heading", { name: en["settings.retention.title"] })).toBeVisible();
  await expectNoAccessibilityViolations(page);
});

const persistedPipeline: Pipeline = {
  contractVersion: "v1",
  createdAt: "2026-08-13T12:00:00.000Z",
  edges: [{ fromStepId: "433e4567-e89b-12d3-a456-426614174002", toStepId: "433e4567-e89b-12d3-a456-426614174003" }],
  id: "433e4567-e89b-12d3-a456-426614174001",
  name: "Persisted orders",
  ownerUserId: "433e4567-e89b-12d3-a456-426614174004",
  state: "enabled",
  steps: [
    {
      componentType: "source.csv",
      componentVersion: "v1",
      configuration: { secretBindings: [], values: { path: "orders.csv" } },
      id: "433e4567-e89b-12d3-a456-426614174002",
      kind: "source",
    },
    {
      componentType: "export.json",
      componentVersion: "v1",
      configuration: { secretBindings: [], values: { path: "orders.json" } },
      id: "433e4567-e89b-12d3-a456-426614174003",
      kind: "export",
    },
  ],
  triggers: [],
  updatedAt: "2026-08-13T12:00:00.000Z",
};
