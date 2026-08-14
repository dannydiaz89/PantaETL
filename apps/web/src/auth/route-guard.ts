import { redirect } from "@tanstack/react-router";

import { getSession, type SessionIdentity } from "./session.js";

/** Route context supplied to a guarded control-plane page. */
export interface AuthenticatedRouteContext {
  readonly session: SessionIdentity;
}

/**
 * Server-side guard shared by every page that reads owner-scoped control-plane data.
 *
 * Sending an unauthenticated visitor to the sign-in page keeps them from landing on a
 * page whose API requests would all be rejected, and carries the requested location so
 * signing in returns them to it.
 */
export async function requireSession({ location }: { location: { href: string } }): Promise<AuthenticatedRouteContext> {
  const session = await getSession();
  if (session === null) {
    throw redirect({ search: { returnTo: location.href }, to: "/login" });
  }

  return { session };
}
