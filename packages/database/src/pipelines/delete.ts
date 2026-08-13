import type { PipelineState } from "@pantaetl/contracts";
import { isPipelineEditable, type ActivePipelineRun } from "@pantaetl/pipeline";
import { and, eq, inArray } from "drizzle-orm";

import type { DatabaseClient } from "../client.js";
import { pipelines } from "../schema/pipelines.js";
import { runs } from "../schema/execution.js";

/** Trusted caller identity and target pipeline for an owner-scoped deletion. */
export interface DeletePipelineInput {
  /** Pipeline identity supplied by the caller. */
  readonly pipelineId: string;
  /** Authenticated owner allowed to remove the pipeline. */
  readonly ownerUserId: string;
}

/** Raised when queued or executing work prevents a pipeline from being removed. */
export class PipelineDeletionLockedError extends Error {
  /** Explain why the delete request cannot change the protected pipeline. */
  constructor() {
    super("Pipeline configuration is locked while a run is queued or active.");
    this.name = "PipelineDeletionLockedError";
  }
}

/** Raised when deleting a pipeline would violate durable run-history retention. */
export class PipelineDeletionHasRunHistoryError extends Error {
  /** Explain why a pipeline with retained execution records is preserved. */
  constructor() {
    super("Pipelines with retained run history cannot be deleted.");
    this.name = "PipelineDeletionHasRunHistoryError";
  }
}

/**
 * Removes an idle pipeline owned by the authenticated caller.
 *
 * PostgreSQL cascades this deletion to the pipeline's components, edges, and
 * triggers. Durable execution records use restrictive foreign keys, so this
 * operation rejects pipelines with retained run history instead of deleting it.
 */
export async function deletePipeline(
  db: DatabaseClient,
  input: DeletePipelineInput,
): Promise<boolean> {
  return db.transaction(async (transaction) => {
    const [pipeline] = await transaction
      .select({ id: pipelines.id, state: pipelines.state })
      .from(pipelines)
      .where(and(eq(pipelines.id, input.pipelineId), eq(pipelines.ownerUserId, input.ownerUserId)))
      .limit(1)
      .for("update");

    if (!pipeline) {
      return false;
    }

    const [activeRun] = await transaction
      .select({ cancellationRequestedAt: runs.cancellationRequestedAt, id: runs.id, state: runs.state })
      .from(runs)
      .where(and(eq(runs.pipelineId, pipeline.id), inArray(runs.state, ["queued", "running"])))
      .limit(1);

    if (!isPipelineEditable(executionState(pipeline.state, activeRun))) {
      throw new PipelineDeletionLockedError();
    }

    const [retainedRun] = await transaction
      .select({ id: runs.id })
      .from(runs)
      .where(eq(runs.pipelineId, pipeline.id))
      .limit(1);

    if (retainedRun) {
      throw new PipelineDeletionHasRunHistoryError();
    }

    const deletedPipelines = await transaction
      .delete(pipelines)
      .where(and(eq(pipelines.id, pipeline.id), eq(pipelines.ownerUserId, input.ownerUserId)))
      .returning({ id: pipelines.id });

    return deletedPipelines.length === 1;
  });
}

/** Builds the shared domain representation used to check the edit lock. */
function executionState(
  pipelineState: PipelineState,
  activeRun: { readonly cancellationRequestedAt: Date | null; readonly id: string; readonly state: string } | undefined,
) {
  const domainActiveRun = activeRun === undefined ? undefined : toActivePipelineRun(activeRun);

  return {
    activeRun: domainActiveRun,
    pipelineState,
    queuedRunIds: [],
  };
}

/** Maps the persisted queued/running record into the domain's execution lock. */
function toActivePipelineRun(activeRun: {
  readonly cancellationRequestedAt: Date | null;
  readonly id: string;
  readonly state: string;
}): ActivePipelineRun {
  if (activeRun.state !== "queued" && activeRun.state !== "running") {
    throw new Error("Pipeline deletion requires an active run state.");
  }

  return {
    cancellationRequested: activeRun.cancellationRequestedAt !== null,
    id: activeRun.id,
    state: activeRun.state,
  };
}
