import { createServerFn } from "@tanstack/react-start";

import { ensureFirstAdmin } from "./admin.js";
import { controlPlaneDatabase } from "./server.js";

/**
 * Seeds the first administrator for a deployment that has no accounts yet.
 *
 * Serving the sign-in page is the moment this matters, so the check runs there: a fresh
 * installation, and an existing one pointed at a new or restored database, both become
 * signable-in without an operator running anything. It settles to a single indexed read
 * once an account exists.
 */
export const ensureDeploymentSeeded = createServerFn({ method: "GET" }).handler(async (): Promise<void> => {
  await ensureFirstAdmin(controlPlaneDatabase);
});
