/** Runtime configuration needed to start a TypeScript service shell. */
export interface ServiceConfig {
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

/** Reads host and port settings without introducing service-specific behavior. */
export function loadConfig(serviceName: string, defaultPort: number): ServiceConfig {
  return {
    host: process.env.HOST ?? '127.0.0.1',
    port: readPort(process.env.PORT, defaultPort),
    serviceName,
  };
}
