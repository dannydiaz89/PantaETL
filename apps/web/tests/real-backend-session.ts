import type { Browser, BrowserContext } from "@playwright/test";

import { createSessionCookies, createTestUser, deleteTestUser } from "./test-session.js";

/** One throwaway signed-in owner, backed by a real database row, for a real-backend browser test. */
export interface RealBackendSession {
  readonly context: BrowserContext;
  /** Deletes this session's pipelines, runs, and user row; call once the test is done with the context. */
  readonly cleanup: () => Promise<void>;
  readonly ownerUserId: string;
}

/**
 * Creates a throwaway local user, signs it in through the real authentication library to
 * obtain a genuine session cookie, and returns a browser context carrying that cookie.
 *
 * The context deliberately starts from empty storage rather than the suite's shared
 * signed-in state, so each real-backend test observes only its own pipelines.
 */
export async function createRealBackendSession(browser: Browser, baseUrl: string): Promise<RealBackendSession> {
  const user = await createTestUser();
  const cookies = await createSessionCookies(user, baseUrl);

  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  await context.addCookies([...cookies]);

  return {
    cleanup: () => deleteTestUser(user.id),
    context,
    ownerUserId: user.id,
  };
}
