/** Server-side configuration required to issue securely signed local sessions. */
export interface AuthConfig {
  readonly databaseUrl: string;
  readonly secret: string;
  readonly trustedOrigins: readonly string[];
}

/** Reads authentication settings without exposing secrets to browser code. */
export function loadAuthConfig(environment: NodeJS.ProcessEnv = process.env): AuthConfig {
  const databaseUrl = environment.DATABASE_URL?.trim();
  const secret = environment.BETTER_AUTH_SECRET?.trim();
  const origins = environment.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0) ?? [];

  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error("DATABASE_URL is required for authentication.");
  }
  if (secret === undefined || secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
  }

  return { databaseUrl, secret, trustedOrigins: origins };
}
