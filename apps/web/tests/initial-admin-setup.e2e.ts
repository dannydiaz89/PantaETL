import { randomUUID } from "node:crypto";

import { accounts, createDatabaseConnection } from "@pantaetl/database";
import { eq } from "drizzle-orm";
import { expect, test } from "@playwright/test";

import { en } from "../src/locales/en.js";
import { createSessionCookies, createTestUser, deleteTestUser, TEST_DATABASE_URL, type TestUser } from "./test-session.js";

/**
 * Creates an account in the state a freshly seeded deployment leaves behind.
 *
 * Seeding through the real entry point is not usable here because it only acts on a
 * deployment with no accounts, which a shared test database never is; what this check
 * cares about is the restriction that seeding leaves on the account.
 */
async function seedUnsecuredInstallation(): Promise<TestUser> {
  return createTestUser({ requiresPasswordChange: true });
}

/** Reads the stored credential digest so a change can be proven rather than assumed. */
async function readCredentialDigest(userId: string): Promise<string | null | undefined> {
  const connection = createDatabaseConnection(TEST_DATABASE_URL);
  try {
    const [credential] = await connection.db.select({ password: accounts.password }).from(accounts).where(eq(accounts.userId, userId)).limit(1);
    return credential?.password;
  } finally {
    await connection.close();
  }
}

test("a deployment on its installation credentials must secure itself before anything else", async ({ browser, baseURL }) => {
  if (baseURL === undefined) {
    throw new Error("Playwright baseURL is required for a first-run setup test.");
  }

  const installation = await seedUnsecuredInstallation();
  const cookies = await createSessionCookies(installation, baseURL);
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  await context.addCookies([...cookies]);

  try {
    const page = await context.newPage();

    // Every authenticated destination hands the visitor to setup instead.
    for (const guarded of ["/pipelines", "/runs", "/settings"]) {
      await page.goto(guarded);
      await expect(page.getByRole("heading", { name: en["welcome.title"] })).toBeVisible();
    }

    // The API stays closed too, so the published password cannot drive the control plane.
    expect((await context.request.get(`${baseURL}/api/pipelines`)).status()).toBe(401);

    const chosenEmail = `secured-${randomUUID()}@pantaetl.test`;
    const digestBefore = await readCredentialDigest(installation.id);

    await page.locator('input[name="email"]').fill(chosenEmail);
    await page.locator('input[name="password"]').fill("a-genuinely-new-password");
    await page.locator('input[name="confirmation"]').fill("a-different-password-entirely");
    await page.getByRole("button", { name: en["welcome.submit"] }).click();
    await expect(page.getByText(en["welcome.error.mismatch"])).toBeVisible();

    await page.locator('input[name="confirmation"]').fill("a-genuinely-new-password");
    await page.getByRole("button", { name: en["welcome.submit"] }).click();

    // Setup complete: the control plane opens and the installation restriction is gone.
    await expect(page.getByRole("heading", { name: en["overview.title"] })).toBeVisible({ timeout: 15_000 });
    expect(await readCredentialDigest(installation.id)).not.toBe(digestBefore);
    expect((await context.request.get(`${baseURL}/api/pipelines`)).status()).toBe(200);

    // A guarded page now serves its own content instead of handing the visitor to setup.
    await page.goto("/pipelines");
    await expect(page.getByRole("heading", { name: en["pipeline.list.title"] })).toBeVisible();

    // The setup screen cannot be revisited once the deployment is secured.
    await page.goto("/welcome");
    await expect(page.getByRole("heading", { name: en["welcome.title"] })).toHaveCount(0);
  } finally {
    await deleteTestUser(installation.id);
    await context.close();
  }
});
