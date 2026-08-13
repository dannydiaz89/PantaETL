import { AxeBuilder } from "@axe-core/playwright";
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

test("pipeline editor exposes the active-run edit lock", async ({ page }) => {
  await page.goto("/pipelines");
  await waitForApplication(page);
  await expect(page.locator(".pipeline-workspace")).toHaveAttribute("data-hydrated", "true");
  const nameInput = page.getByLabel(en["pipeline.name"]);

  await expect(nameInput).toBeDisabled();
  await expect(page.getByRole("status")).toContainText(en["pipeline.locked.title"]);
  await page.getByRole("button", { exact: true, name: en["pipeline.open"] }).nth(1).click();
  await expect(nameInput).toBeEnabled();
  await page.getByRole("tab", { name: en["pipeline.tab.trigger"] }).click();
  await expect(page.getByText(en["pipeline.trigger.description"])).toBeVisible();
  await expectNoAccessibilityViolations(page);
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
