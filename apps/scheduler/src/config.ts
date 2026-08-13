/** Runtime configuration needed to start a TypeScript service shell. */
export interface ServiceConfig {
  readonly databaseUrl: string;
  readonly host: string;
  readonly internalToken: string;
  readonly port: number;
  readonly serviceName: string;
}

function readDatabaseUrl(value: string | undefined): string {
  const databaseUrl = value?.trim();

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  return databaseUrl;
}

function readPort(value: string | undefined, fallback: number): number {
  const port = Number(value ?? fallback);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

/** Read the token that authenticates control-plane requests to scheduler internals. */
function readInternalToken(value: string | undefined): string {
  const token = value?.trim();

  if (!token || token.length < 32) {
    throw new Error("SCHEDULER_INTERNAL_TOKEN must contain at least 32 characters.");
  }

  return token;
}

/** Reads host and port settings without introducing service-specific behavior. */
export function loadConfig(serviceName: string, defaultPort: number): ServiceConfig {
  return {
    databaseUrl: readDatabaseUrl(process.env.DATABASE_URL),
    host: process.env.HOST ?? '127.0.0.1',
    internalToken: readInternalToken(process.env.SCHEDULER_INTERNAL_TOKEN),
    port: readPort(process.env.PORT, defaultPort),
    serviceName,
  };
}
