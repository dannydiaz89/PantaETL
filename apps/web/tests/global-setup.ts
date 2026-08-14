import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { FullConfig } from "@playwright/test";

import { createSessionCookies, createTestUser } from "./test-session.js";

/** Where the signed-in browser state shared by mock-backed tests is written. */
export const STORAGE_STATE_PATH = "tests/.auth/state.json";
/** Where the throwaway owner's identity is recorded so teardown can remove it. */
export const STORAGE_USER_PATH = "tests/.auth/user.json";

/**
 * Signs one throwaway owner in before the suite so guarded pages render instead of
 * redirecting to the sign-in form.
 *
 * Tests that assert against mocked pipeline responses still need a genuine session,
 * because the route guard resolves it on the server before any page component runs.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseUrl = config.projects[0]?.use.baseURL;
  if (typeof baseUrl !== "string") {
    throw new Error("A baseURL is required to establish the shared browser session.");
  }

  const user = await createTestUser();
  const cookies = await createSessionCookies(user, baseUrl);
  const { host, protocol } = new URL(baseUrl);

  await mkdir(dirname(STORAGE_STATE_PATH), { recursive: true });
  await writeFile(STORAGE_STATE_PATH, JSON.stringify({
    cookies: cookies.map((cookie) => ({
      domain: host.split(":")[0],
      expires: -1,
      httpOnly: true,
      name: cookie.name,
      path: "/",
      sameSite: "Lax",
      secure: protocol === "https:",
      value: cookie.value,
    })),
    origins: [],
  }));
  await writeFile(STORAGE_USER_PATH, JSON.stringify(user));
}
