import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import {
  AdminSetupError,
  completeInitialAdminSetup,
  type AdminSetupRejection,
} from "./admin.js";
import { auth, controlPlaneDatabase } from "./server.js";

/** Outcome of a first-run credential change, carrying only a safe reason when refused. */
export type AdminSetupOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: AdminSetupRejection | "unauthenticated" };

/**
 * Applies the first administrator's chosen address and password.
 *
 * The session is resolved server-side rather than trusted from the caller, so the change
 * can only ever target the signed-in account that still requires it.
 */
export const completeAdminSetup = createServerFn({ method: "POST" })
  .validator((input: { readonly email: string; readonly password: string }) => input)
  .handler(async ({ data }): Promise<AdminSetupOutcome> => {
    const session = await auth.api.getSession({ headers: getRequestHeaders() });
    if (session === null || !session.user.requiresPasswordChange) {
      return { ok: false, reason: "unauthenticated" };
    }

    try {
      await completeInitialAdminSetup(controlPlaneDatabase, {
        email: data.email,
        password: data.password,
        userId: session.user.id,
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof AdminSetupError) {
        return { ok: false, reason: error.reason };
      }

      throw error;
    }
  });
