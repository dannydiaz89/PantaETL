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

  // A deployment still using its first-run credentials may reach setup and nothing else.
  if (session.requiresPasswordChange) {
    throw redirect({ to: "/welcome" });
  }

  return { session };
}

/**
 * Guard for the first-run setup page itself.
 *
 * Mirrors `requireSession` but admits exactly the accounts that page exists to serve, so
 * an administrator who has already completed setup cannot return to it.
 */
export async function requireInitialSetup({ location }: { location: { href: string } }): Promise<AuthenticatedRouteContext> {
  const session = await getSession();
  if (session === null) {
    throw redirect({ search: { returnTo: location.href }, to: "/login" });
  }
  if (!session.requiresPasswordChange) {
    throw redirect({ to: "/" });
  }

  return { session };
}
