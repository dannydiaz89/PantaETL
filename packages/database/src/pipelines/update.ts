import { and, eq, inArray } from "drizzle-orm";

import {
  pipelineIdSchema,
  pipelineUpdateRequestSchema,
  userIdSchema,
  type Pipeline,
  type PipelineCreateRequest,
  type PipelineId,
  type PipelineUpdateRequest,
  type UserId,
  type WritablePipelineTrigger,
} from "@pantaetl/contracts";
import {
  createPipelineExecutionState,
  setPipelineState,
  type ActivePipelineRun,
} from "@pantaetl/pipeline";

import type { DatabaseClient } from "../client.js";
import { runs } from "../schema/execution.js";
import { pipelineComponents, pipelineEdges, pipelines, pipelineTriggers } from "../schema/pipelines.js";
import { validatePipelineGraph } from "./create.js";
import { hydratePipeline, type PersistedPipelineGraph } from "./hydration.js";

/** Trusted owner context and validated fields used to atomically update one pipeline. */
export interface UpdatePipelineInput {
  /** The authenticated user who must own the pipeline. */
  readonly ownerUserId: UserId;
  /** The owner-scoped pipeline identity to update. */
  readonly pipelineId: PipelineId;
  /** The mutable pipeline fields received from the control-plane boundary. */
  readonly update: PipelineUpdateRequest;
}

type PipelineTransaction = Parameters<DatabaseClient["transaction"]>[0] extends (
  transaction: infer Transaction,
) => unknown
  ? Transaction
  : never;

const activeRunStates = ["queued", "running"] as const;

/**
 * Atomically updates an idle pipeline graph owned by the authenticated user.
 *
 * Replacing `steps` is an explicit replacement of component configuration and
 * secret binding references. Updates that omit `steps` leave persisted component
 * records, including their bindings, untouched.
 */
export async function updatePipeline(
  db: DatabaseClient,
  input: UpdatePipelineInput,
  now: Date = new Date(),
): Promise<Pipeline | undefined> {
  const ownerUserId = userIdSchema.parse(input.ownerUserId) as UserId;
  const pipelineId = pipelineIdSchema.parse(input.pipelineId) as PipelineId;
  const update = pipelineUpdateRequestSchema.parse(input.update) as PipelineUpdateRequest;

  return db.transaction((transaction) => updatePipelineInTransaction(
    transaction,
    { ownerUserId, pipelineId, update },
    now,
  ));
}

/** Update an idle owner-scoped graph inside a caller-owned transaction. */
async function updatePipelineInTransaction(
  transaction: PipelineTransaction,
  input: UpdatePipelineInput,
  now: Date,
): Promise<Pipeline | undefined> {
  const [persistedPipeline] = await transaction
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.id, input.pipelineId), eq(pipelines.ownerUserId, input.ownerUserId)))
    .for("update")
    .limit(1);

  if (!persistedPipeline) {
    return undefined;
  }

  const activeRun = await findActiveRun(transaction, input.pipelineId);
  const executionState = createPipelineExecutionState(persistedPipeline.state);
  const lockedExecutionState = activeRun
    ? { ...executionState, activeRun }
    : executionState;
  const nextState = input.update.state ?? persistedPipeline.state;
  setPipelineState(lockedExecutionState, nextState);

  const existingGraph = await readPipelineGraph(transaction, persistedPipeline);
  const existing = hydratePipeline(existingGraph);
  const replacement = mergeUpdate(existing, input.update);
  validatePipelineGraph(replacement);

  const [updatedPipeline] = await transaction
    .update(pipelines)
    .set({ name: replacement.name, state: nextState, updatedAt: now })
    .where(eq(pipelines.id, input.pipelineId))
    .returning();

  if (!updatedPipeline) {
    throw new Error("Pipeline update did not return a persisted pipeline.");
  }

  const graph = await replaceGraphRecords(transaction, updatedPipeline, replacement, input.update);
  return hydratePipeline(graph);
}

/** Read the full persisted graph after its owning pipeline row has been locked. */
async function readPipelineGraph(
  transaction: PipelineTransaction,
  pipeline: typeof pipelines.$inferSelect,
): Promise<PersistedPipelineGraph> {
  const [components, edges, triggers] = await Promise.all([
    transaction.select().from(pipelineComponents).where(eq(pipelineComponents.pipelineId, pipeline.id)),
    transaction.select().from(pipelineEdges).where(eq(pipelineEdges.pipelineId, pipeline.id)),
    transaction.select().from(pipelineTriggers).where(eq(pipelineTriggers.pipelineId, pipeline.id)),
  ]);

  return { components, edges, pipeline, triggers };
}

/** Return one queued or running record so the shared state machine enforces the edit lock. */
async function findActiveRun(
  transaction: PipelineTransaction,
  pipelineId: PipelineId,
): Promise<ActivePipelineRun | undefined> {
  const [activeRun] = await transaction
    .select({ cancellationRequestedAt: runs.cancellationRequestedAt, id: runs.id, state: runs.state })
    .from(runs)
    .where(and(eq(runs.pipelineId, pipelineId), inArray(runs.state, activeRunStates)))
    .for("update")
    .limit(1);

  if (!activeRun) {
    return undefined;
  }

  if (activeRun.state !== "queued" && activeRun.state !== "running") {
    throw new Error("Pipeline edit lock selected a non-active run.");
  }

  return {
    cancellationRequested: activeRun.cancellationRequestedAt !== null,
    id: activeRun.id,
    state: activeRun.state,
  };
}

/** Build the complete validated graph that results from applying one partial update. */
function mergeUpdate(existing: Pipeline, update: PipelineUpdateRequest): PipelineCreateRequest {
  return {
    contractVersion: existing.contractVersion,
    edges: update.edges ?? existing.edges,
    name: update.name ?? existing.name,
    steps: update.steps ?? existing.steps,
    triggers: update.triggers ?? existing.triggers.map(toWritableTrigger),
  };
}

/** Remove server-assigned trigger identifiers before using existing triggers as writable input. */
function toWritableTrigger(trigger: Pipeline["triggers"][number]): WritablePipelineTrigger {
  if (trigger.type === "manual") {
    return { enabled: trigger.enabled, type: "manual" };
  }

  return {
    cron: trigger.cron,
    enabled: trigger.enabled,
    timezone: trigger.timezone,
    type: "schedule",
  };
}

/**
 * Replace only graph tables named by the update and return their persisted records.
 *
 * Component replacement removes edges first because they reference component IDs.
 * The surrounding transaction restores the original graph if any later write fails.
 */
async function replaceGraphRecords(
  transaction: PipelineTransaction,
  pipeline: typeof pipelines.$inferSelect,
  replacement: PipelineCreateRequest,
  update: PipelineUpdateRequest,
): Promise<PersistedPipelineGraph> {
  const replacingComponents = update.steps !== undefined;
  const replacingEdges = replacingComponents || update.edges !== undefined;
  const replacingTriggers = update.triggers !== undefined;

  if (replacingEdges) {
    await transaction.delete(pipelineEdges).where(eq(pipelineEdges.pipelineId, pipeline.id));
  }

  const components = replacingComponents
    ? await replaceComponents(transaction, pipeline.id, replacement)
    : await transaction.select().from(pipelineComponents).where(eq(pipelineComponents.pipelineId, pipeline.id));

  const edges = replacingEdges
    ? await insertEdges(transaction, pipeline.id, replacement)
    : await transaction.select().from(pipelineEdges).where(eq(pipelineEdges.pipelineId, pipeline.id));

  const triggers = replacingTriggers
    ? await replaceTriggers(transaction, pipeline.id, replacement)
    : await transaction.select().from(pipelineTriggers).where(eq(pipelineTriggers.pipelineId, pipeline.id));

  return { components, edges, pipeline, triggers };
}

/** Replace every component only after dependent graph edges have been removed. */
async function replaceComponents(
  transaction: PipelineTransaction,
  pipelineId: string,
  replacement: PipelineCreateRequest,
): Promise<readonly (typeof pipelineComponents.$inferSelect)[]> {
  await transaction.delete(pipelineComponents).where(eq(pipelineComponents.pipelineId, pipelineId));
  return transaction
    .insert(pipelineComponents)
    .values(replacement.steps.map((step) => ({
      componentType: step.componentType,
      componentVersion: step.componentVersion,
      configurationValues: step.configuration.values,
      id: step.id,
      kind: step.kind,
      pipelineId,
      secretBindings: step.configuration.secretBindings,
    })))
    .returning();
}

/** Persist the replacement edge set after every referenced component is present. */
async function insertEdges(
  transaction: PipelineTransaction,
  pipelineId: string,
  replacement: PipelineCreateRequest,
): Promise<readonly (typeof pipelineEdges.$inferSelect)[]> {
  if (replacement.edges.length === 0) {
    return [];
  }

  return transaction
    .insert(pipelineEdges)
    .values(replacement.edges.map((edge) => ({
      fromComponentId: edge.fromStepId,
      pipelineId,
      toComponentId: edge.toStepId,
    })))
    .returning();
}

/** Replace all pipeline-owned triggers when the update explicitly supplies them. */
async function replaceTriggers(
  transaction: PipelineTransaction,
  pipelineId: string,
  replacement: PipelineCreateRequest,
): Promise<readonly (typeof pipelineTriggers.$inferSelect)[]> {
  await transaction.delete(pipelineTriggers).where(eq(pipelineTriggers.pipelineId, pipelineId));

  if (replacement.triggers.length === 0) {
    return [];
  }

  return transaction
    .insert(pipelineTriggers)
    .values(replacement.triggers.map((trigger) => (
      trigger.type === "manual"
        ? { enabled: trigger.enabled, pipelineId, type: trigger.type }
        : {
          cron: trigger.cron,
          enabled: trigger.enabled,
          pipelineId,
          timezone: trigger.timezone,
          type: trigger.type,
        }
    )))
    .returning();
}
