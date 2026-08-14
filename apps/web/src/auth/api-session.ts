import { auth } from "./server.js";

/**
 * Resolves a session for the API boundary, treating first-run credentials as unusable.
 *
 * A deployment still holding its installation password must complete setup before any
 * owner-scoped endpoint will answer, so the well-known credentials cannot be used to
 * operate the control plane by calling the API directly. This module reaches the server
 * authentication instance, so only server handlers may import it.
 */
export async function getApiSession(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  return session === null || session.user.requiresPasswordChange ? null : session;
}
