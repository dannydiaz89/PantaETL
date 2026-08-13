/** Runtime configuration needed to start a TypeScript service shell. */
export interface ServiceConfig {
  readonly databaseUrl: string;
  readonly host: string;
  readonly port: number;
  readonly serviceName: string;
}

function readPort(value: string | undefined, fallback: number): number {
  const port = Number(value ?? fallback);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

/** Reads the required database URL without ever including it in a log message. */
function readDatabaseUrl(value: string | undefined): string {
  if (value === undefined || value.trim().length === 0) {
    throw new Error('DATABASE_URL is required.');
  }

  return value;
}

/** Reads host and port settings without introducing service-specific behavior. */
export function loadConfig(serviceName: string, defaultPort: number): ServiceConfig {
  return {
    databaseUrl: readDatabaseUrl(process.env.DATABASE_URL),
    host: process.env.HOST ?? '127.0.0.1',
    port: readPort(process.env.PORT, defaultPort),
    serviceName,
  };
}
