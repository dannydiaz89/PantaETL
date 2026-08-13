import { controlPlaneDatabase } from "../auth/server.js";

import { getSystemHealth, loadSystemHealthConfig } from "./health.js";

/** Collects current application health using server-only control-plane dependencies. */
export async function loadSystemHealth() {
  return getSystemHealth({
    config: loadSystemHealthConfig(),
    database: controlPlaneDatabase,
    fetch: (url, init) => fetch(url, init),
  });
}
