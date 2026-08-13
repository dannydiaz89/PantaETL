import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { auth } from "./server.js";

/** Safe session identity used by protected route boundaries. */
export interface SessionIdentity {
  readonly email: string;
  readonly id: string;
  readonly isAdmin: boolean;
  readonly requiresPasswordChange: boolean;
  readonly username: string;
}

/** Reads the active server-side session without exposing credential records. */
export const getSession = createServerFn({ method: "GET" }).handler(async (): Promise<SessionIdentity | null> => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (session === null) {
    return null;
  }

  return {
    email: session.user.email,
    id: session.user.id,
    isAdmin: Boolean(session.user.isAdmin),
    requiresPasswordChange: Boolean(session.user.requiresPasswordChange),
    username: session.user.name,
  };
});
