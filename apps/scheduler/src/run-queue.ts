import { and, asc, eq, inArray } from "drizzle-orm";

import { pipelineIdSchema, type PipelineId } from "@pantaetl/contracts";
import type { DatabaseClient } from "@pantaetl/database";
import {
  calculateRunLogExpiry,
  getRunLogRetentionDays,
  jobs,
  pipelineComponents,
  pipelines,
  recordOperationalEvent,
  recordOperationalEvents,
  runs,
  runSteps,
} from "@pantaetl/database";

/** A persisted trigger occurrence ready to become a pipeline run. */
export interface PipelineRunRequest {
  readonly pipelineId: string;
  readonly scheduledFor?: Date;
  readonly triggerId?: string;
}

/** A newly persisted run and whether it can immediately expose source jobs to workers. */
export interface CreatedPipelineRun {
  readonly initialJobCount: number;
  readonly pipelineId: PipelineId;
  readonly queuedBehindActiveRun: boolean;
  readonly runId: string;
}

/** A pipeline whose next queued run was made active for worker processing. */
export interface PromotedPipelineRun {
  readonly pipelineId: PipelineId;
  readonly runId: string;
}

/** The transaction shape shared by scheduler persistence operations. */
type SchedulerTransaction = Parameters<DatabaseClient["transaction"]>[0] extends (
  transaction: infer Transaction,
) => unknown
  ? Transaction
  : never;

const activeRunStates = ["queued", "running"] as const;
const terminalRunStates = ["succeeded", "completed_with_warnings", "failed", "cancelled"] as const;

/** The maximum number of completed pipelines advanced by one scheduler pass. */
export const DEFAULT_QUEUED_RUN_PROMOTION_LIMIT = 100;

/**
 * Atomically persist a pipeline run and initial Source jobs when the pipeline is free.
 *
 * The owning pipeline row is locked before inspecting active work. That lock makes
 * concurrent scheduler instances serialize one pipeline while unrelated pipelines
 * can create their runs independently.
 */
export async function createPipelineRun(
  db: DatabaseClient,
  request: PipelineRunRequest,
  now: Date = new Date(),
): Promise<CreatedPipelineRun> {
  const pipelineId = pipelineIdSchema.parse(request.pipelineId) as PipelineId;
  return db.transaction((transaction) =>
    createPipelineRunInTransaction(transaction, { ...request, pipelineId }, now),
  );
}

/** Create or queue one run inside a caller-owned database transaction. */
export async function createPipelineRunInTransaction(
  transaction: SchedulerTransaction,
  request: PipelineRunRequest,
  now: Date,
): Promise<CreatedPipelineRun> {
  const pipelineId = pipelineIdSchema.parse(request.pipelineId) as PipelineId;
  const [pipeline] = await transaction
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(eq(pipelines.id, pipelineId))
    .for("update")
    .limit(1);

  if (!pipeline) {
    throw new Error("Cannot create a run for a pipeline that does not exist.");
  }

  const retentionDays = await getRunLogRetentionDays(transaction);

  await transaction
    .update(runs)
    .set({ isActive: false })
    .where(
      and(
        eq(runs.pipelineId, pipelineId),
        eq(runs.isActive, true),
        inArray(runs.state, terminalRunStates),
      ),
    );

  let activeRun = await findActiveRun(transaction, pipelineId);
  if (!activeRun) {
    activeRun = await promoteOldestQueuedRun(transaction, pipelineId, now);
  }

  const [run] = await transaction
    .insert(runs)
    .values({
      isActive: activeRun === undefined,
      createdAt: now,
      expiresAt: calculateRunLogExpiry(now, retentionDays),
      pipelineId,
      scheduledFor: request.scheduledFor,
      state: "queued",
      triggerId: request.triggerId,
    })
    .returning({ id: runs.id });

  if (!run) {
    throw new Error("Pipeline run creation did not return a persisted run.");
  }

  await recordOperationalEvent(transaction, {
    event: "run_queued",
    occurredAt: now,
    pipelineId,
    runId: run.id,
  });

  const initialJobCount = activeRun
    ? 0
    : await createInitialSourceJobs(transaction, pipelineId, run.id, now);

  return {
    initialJobCount,
    pipelineId,
    queuedBehindActiveRun: activeRun !== undefined,
    runId: run.id,
  };
}

/**
 * Releases terminal active runs and advances their oldest waiting run in FIFO order.
 *
 * This is a short scheduler transaction, not part of worker execution. It guarantees
 * that a same-pipeline backlog progresses even when no later trigger arrives.
 */
export async function promoteQueuedPipelineRuns(
  db: DatabaseClient,
  now: Date = new Date(),
  limit: number = DEFAULT_QUEUED_RUN_PROMOTION_LIMIT,
): Promise<readonly PromotedPipelineRun[]> {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error("Queued run promotion limit must be a positive safe integer.");
  }

  return db.transaction(async (transaction) => {
    const completedRuns = await transaction
      .select({ pipelineId: runs.pipelineId })
      .from(runs)
      .where(and(eq(runs.isActive, true), inArray(runs.state, terminalRunStates)))
      .orderBy(asc(runs.completedAt), asc(runs.id))
      .limit(limit)
      .for("update", { skipLocked: true });
    const promotedRuns: PromotedPipelineRun[] = [];

    for (const completedRun of completedRuns) {
      const pipelineId = completedRun.pipelineId as PipelineId;
      await transaction.select({ id: pipelines.id }).from(pipelines).where(eq(pipelines.id, pipelineId)).for("update");
      await transaction
        .update(runs)
        .set({ isActive: false })
        .where(
          and(
            eq(runs.pipelineId, pipelineId),
            eq(runs.isActive, true),
            inArray(runs.state, terminalRunStates),
          ),
        );
      const promotedRun = await promoteOldestQueuedRun(transaction, pipelineId, now);

      if (promotedRun) {
        promotedRuns.push({ pipelineId, runId: promotedRun.id });
      }
    }

    return promotedRuns;
  });
}

/** Find the current run that blocks later same-pipeline work. */
async function findActiveRun(
  transaction: SchedulerTransaction,
  pipelineId: PipelineId,
): Promise<{ readonly id: string } | undefined> {
  const [activeRun] = await transaction
    .select({ id: runs.id })
    .from(runs)
    .where(
      and(
        eq(runs.pipelineId, pipelineId),
        eq(runs.isActive, true),
        inArray(runs.state, activeRunStates),
      ),
    )
    .for("update")
    .limit(1);

  return activeRun;
}

/** Promote the oldest waiting run and make its source jobs eligible for workers. */
async function promoteOldestQueuedRun(
  transaction: SchedulerTransaction,
  pipelineId: PipelineId,
  now: Date,
): Promise<{ readonly id: string } | undefined> {
  const [queuedRun] = await transaction
    .select({ id: runs.id })
    .from(runs)
    .where(and(eq(runs.pipelineId, pipelineId), eq(runs.isActive, false), eq(runs.state, "queued")))
    .orderBy(asc(runs.scheduledFor), asc(runs.createdAt), asc(runs.id))
    .for("update")
    .limit(1);

  if (!queuedRun) {
    return undefined;
  }

  await transaction.update(runs).set({ isActive: true }).where(eq(runs.id, queuedRun.id));
  await createInitialSourceJobs(transaction, pipelineId, queuedRun.id, now);
  return queuedRun;
}

/** Create run steps for every component and queued jobs for the initial Source components. */
async function createInitialSourceJobs(
  transaction: SchedulerTransaction,
  pipelineId: PipelineId,
  runId: string,
  now: Date,
): Promise<number> {
  const components = await transaction
    .select({ id: pipelineComponents.id, kind: pipelineComponents.kind })
    .from(pipelineComponents)
    .where(eq(pipelineComponents.pipelineId, pipelineId));

  const sourceComponents = components.filter((component) => component.kind === "source");
  if (sourceComponents.length === 0) {
    throw new Error("Pipeline runs require at least one Source component.");
  }

  const steps = await transaction
    .insert(runSteps)
    .values(components.map((component) => ({ componentId: component.id, runId })))
    .returning({ componentId: runSteps.componentId, id: runSteps.id });
  const stepByComponentId = new Map(steps.map((step) => [step.componentId, step.id]));

  await recordOperationalEvents(
    transaction,
    steps.map((step) => ({
      event: "step_queued" as const,
      occurredAt: now,
      pipelineId,
      runId,
      runStepId: step.id,
    })),
  );

  await transaction.insert(jobs).values(
    sourceComponents.map((component) => {
      const runStepId = stepByComponentId.get(component.id);
      if (!runStepId) {
        throw new Error("Run step creation did not return a Source step.");
      }

      return { availableAt: now, componentId: component.id, pipelineId, runId, runStepId };
    }),
  );

  return sourceComponents.length;
}
