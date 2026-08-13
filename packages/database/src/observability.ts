import type { DatabaseClient } from "./client.js";
import { operationalEvents } from "./schema/execution.js";

/** A database writer that can persist immutable operational events. */
type OperationalEventDatabase = Pick<DatabaseClient, "insert">;

/** Event names supported by the durable operational event store. */
export type OperationalEventKind = (typeof operationalEvents.event.enumValues)[number];

/** Numeric execution counters that are safe to persist as aggregate metadata. */
export interface OperationalMetrics {
  readonly bytesRead?: number;
  readonly bytesWritten?: number;
  readonly durationMs?: number;
  readonly recordsRead?: number;
  readonly recordsWritten?: number;
  readonly retryAttempt?: number;
}

/** Correlated, payload-free lifecycle data for one pipeline execution event. */
export interface OperationalEventInput extends OperationalMetrics {
  readonly event: OperationalEventKind;
  readonly jobId?: string;
  readonly occurredAt?: Date;
  readonly pipelineId: string;
  readonly runId: string;
  readonly runStepId?: string;
  readonly workerId?: string;
}

/**
 * Inserts one operational event after enforcing finite, non-negative aggregate values.
 *
 * The event model intentionally has no free-form context field, preventing records,
 * credentials, and other unbounded payloads from entering durable operational data.
 */
export async function recordOperationalEvent(
  db: OperationalEventDatabase,
  input: OperationalEventInput,
): Promise<void> {
  validateOperationalEvent(input);
  await db.insert(operationalEvents).values(input);
}

/** Records a bounded batch of lifecycle events within the caller's transaction. */
export async function recordOperationalEvents(
  db: OperationalEventDatabase,
  inputs: readonly OperationalEventInput[],
): Promise<void> {
  for (const input of inputs) validateOperationalEvent(input);
  if (inputs.length > 0) await db.insert(operationalEvents).values([...inputs]);
}

/** Reject unsafe metric values before they reach PostgreSQL integer columns. */
export function validateOperationalEvent(input: OperationalEventInput): void {
  for (const [name, value] of Object.entries({
    bytesRead: input.bytesRead,
    bytesWritten: input.bytesWritten,
    durationMs: input.durationMs,
    recordsRead: input.recordsRead,
    recordsWritten: input.recordsWritten,
    retryAttempt: input.retryAttempt,
  })) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
      throw new Error(`${name} must be a non-negative safe integer.`);
    }
  }
}
