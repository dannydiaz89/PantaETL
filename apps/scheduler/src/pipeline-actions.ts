import type { DatabaseClient } from "@pantaetl/database";
import {
  runPipelineForOwner,
  type EnqueuedPipelineRun,
  type PipelineActionInput,
} from "@pantaetl/database";

import { createPipelineRun } from "./run-queue.js";

/**
 * Enqueue an authenticated owner's manual run through the scheduler's durable queue.
 *
 * Ownership and state preconditions are enforced before delegation, while the queue
 * implementation retains the transaction that serializes same-pipeline runs.
 */
export async function enqueuePipelineRunForOwner(
  db: DatabaseClient,
  input: PipelineActionInput,
  now: Date = new Date(),
): Promise<EnqueuedPipelineRun> {
  return runPipelineForOwner(db, input, (pipelineId) => createPipelineRun(db, { pipelineId }, now));
}
