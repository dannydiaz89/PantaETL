import { createServerFn } from "@tanstack/react-start";

/** Safe global settings that can be rendered in the authenticated control plane. */
export interface GlobalSettingsView {
  readonly canManageGlobalSettings: boolean;
  readonly runLogRetentionDays: number;
}

/** Reads current global retention policy and the active user's authority to manage it. */
export const getGlobalSettings = createServerFn({ method: "GET" }).handler(async (): Promise<GlobalSettingsView> => {
  const [{ getRunLogRetentionDays }, { auth, controlPlaneDatabase }, { getRequestHeaders }] = await Promise.all([
    import("@pantaetl/database"),
    import("../auth/server.js"),
    import("@tanstack/react-start/server"),
  ]);
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (session === null) {
    throw new Error("An authenticated session is required to read global settings.");
  }

  return {
    canManageGlobalSettings: Boolean(session.user.isAdmin),
    runLogRetentionDays: await getRunLogRetentionDays(controlPlaneDatabase),
  };
});

/** Validates the narrow global-retention mutation input before it reaches storage. */
export function parseRunLogRetentionUpdate(value: unknown): { readonly runLogRetentionDays: number } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Run and log retention must be provided as an object.");
  }

  const runLogRetentionDays = (value as { runLogRetentionDays?: unknown }).runLogRetentionDays;
  if (typeof runLogRetentionDays !== "number" || !Number.isInteger(runLogRetentionDays) || runLogRetentionDays < 1) {
    throw new Error("Run and log retention days must be a positive integer.");
  }

  return { runLogRetentionDays };
}

/** Updates future run and log expiry policy only for an authenticated administrator. */
export const updateRunLogRetention = createServerFn({ method: "POST" })
  .validator(parseRunLogRetentionUpdate)
  .handler(async ({ data }): Promise<GlobalSettingsView> => {
    const [{ setRunLogRetentionDays }, { auth, controlPlaneDatabase }, { getRequestHeaders }] = await Promise.all([
      import("@pantaetl/database"),
      import("../auth/server.js"),
      import("@tanstack/react-start/server"),
    ]);
    const session = await auth.api.getSession({ headers: getRequestHeaders() });
    if (session === null || !session.user.isAdmin) {
      throw new Error("Administrator privileges are required to change global settings.");
    }

    await setRunLogRetentionDays(controlPlaneDatabase, data.runLogRetentionDays);
    return {
      canManageGlobalSettings: true,
      runLogRetentionDays: data.runLogRetentionDays,
    };
  });
