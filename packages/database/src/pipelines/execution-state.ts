import { and, eq, inArray } from "drizzle-orm";

import type { DatabaseClient } from "../client.js";
import { runs } from "../schema/execution.js";

const activeRunStates = ["queued", "running"] as const;

/** The single queued or running run currently blocking configuration edits for a pipeline. */
export interface ActiveRunSummary {
  /** Stable run identifier assigned by the control plane. */
  readonly id: string;
  /** Execution phase before its terminal result is recorded. */
  readonly state: "queued" | "running";
}

/**
 * Returns the pipeline's single queued or running run, if any.
 *
 * At most one run can be active per pipeline (enforced by a partial unique index on
 * `runs`), so this never needs to disambiguate between multiple in-flight runs. Callers
 * are expected to have already confirmed the pipeline belongs to the requesting owner.
 */
export async function getActiveRunForPipeline(
  db: DatabaseClient,
  pipelineId: string,
): Promise<ActiveRunSummary | undefined> {
  const [activeRun] = await db
    .select({ id: runs.id, state: runs.state })
    .from(runs)
    .where(and(eq(runs.pipelineId, pipelineId), inArray(runs.state, activeRunStates)))
    .limit(1);

  if (activeRun === undefined) {
    return undefined;
  }

  return { id: activeRun.id, state: activeRun.state === "running" ? "running" : "queued" };
}
