/** The structured levels available to a service shell logger. */
export type LogLevel = 'error' | 'info';

/** Writes a safe, structured service event to standard output. */
export function writeLog(
  level: LogLevel,
  message: string,
  context: Record<string, unknown> = {},
): void {
  console.log(JSON.stringify({ level, message, ...context }));
}
