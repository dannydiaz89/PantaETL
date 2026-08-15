import { resolveStorageRoot } from '@pantaetl/config';

/** Runtime configuration needed to start a TypeScript service shell. */
export interface ServiceConfig {
  readonly cleanupBatchSize: number;
  readonly cleanupIntervalMilliseconds: number;
  readonly databaseUrl: string;
  readonly host: string;
  readonly port: number;
  readonly serviceName: string;
  readonly storageRoot: string;
}

function readPort(value: string | undefined, fallback: number): number {
  const port = Number(value ?? fallback);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

/** Reads a positive integer setting without permitting an unbounded cleanup pass. */
function readPositiveInteger(value: string | undefined, fallback: number, name: string): number {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
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
  const cleanupIntervalSeconds = readPositiveInteger(
    process.env.GC_INTERVAL_SECONDS,
    60,
    'GC_INTERVAL_SECONDS',
  );

  return {
    cleanupBatchSize: readPositiveInteger(process.env.GC_BATCH_SIZE, 100, 'GC_BATCH_SIZE'),
    cleanupIntervalMilliseconds: cleanupIntervalSeconds * 1_000,
    databaseUrl: readDatabaseUrl(process.env.DATABASE_URL),
    host: process.env.HOST ?? '127.0.0.1',
    port: readPort(process.env.PORT, defaultPort),
    serviceName,
    storageRoot: resolveStorageRoot(),
  };
}
