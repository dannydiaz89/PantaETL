/**
 * First-run credential facts shared by the browser and the server.
 *
 * These live apart from the administrator commands so the setup screen can state the
 * rules it enforces without pulling server-only password hashing into the browser.
 */

/**
 * Well-known first-run credentials for a freshly installed deployment.
 *
 * A predictable first sign-in is only safe because the account is created needing a
 * credential change: until that change is completed the session can reach the setup
 * screen and nothing else, so these values cannot be used to operate a deployment.
 */
export const DEFAULT_ADMIN_EMAIL = "admin@admin.com";
export const DEFAULT_ADMIN_USERNAME = "admin";
export const DEFAULT_ADMIN_PASSWORD = "changeme";

/** Shortest replacement credential accepted when the first administrator completes setup. */
export const MINIMUM_ADMIN_PASSWORD_LENGTH = 12;

/** Accepts the ordinary single-at address shape used by local administrator records. */
export function isValidAdminEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}
