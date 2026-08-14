import { readFile, rm } from "node:fs/promises";

import { STORAGE_STATE_PATH, STORAGE_USER_PATH } from "./global-setup.js";
import { deleteTestUser, type TestUser } from "./test-session.js";

/** Removes the shared throwaway owner and its stored browser state after the suite finishes. */
export default async function globalTeardown(): Promise<void> {
  try {
    const user: TestUser = JSON.parse(await readFile(STORAGE_USER_PATH, "utf8"));
    await deleteTestUser(user.id);
  } catch {
    // A suite that failed before setup completed leaves nothing to clean up.
  }

  await rm(STORAGE_STATE_PATH, { force: true });
  await rm(STORAGE_USER_PATH, { force: true });
}
