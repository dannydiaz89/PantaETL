import { and, eq, inArray } from "drizzle-orm";

import {
  pipelineIdSchema,
  pipelineStateSchema,
  userIdSchema,
  type PipelineId,
  type PipelineState,
  type UserId,
} from "@pantaetl/contracts";
import {
  PipelineStateTransitionError,
  createPipelineExecutionState,
  enqueuePipelineRun,
  setPipelineState,
} from "@pantaetl/pipeline";

import type { DatabaseClient } from "../client.js";
import { runs } from "../schema/execution.js";
import { pipelines } from "../schema/pipelines.js";

const activeRunStates = ["queued", "running"] as const;

/** A reason an owner-scoped pipeline action cannot proceed. */
export type PipelineActionConflictReason = "locked" | "not_enabled" | "not_found";

/** A safe, structured action failure that HTTP routes can map without parsing messages. */
export class PipelineActionConflictError extends Error {
  /** Machine-readable reason for the rejected action. */
  readonly reason: PipelineActionConflictReason;

  /** Creates a safe conflict error for an owner-scoped pipeline action. */
  constructor(reason: PipelineActionConflictReason, message: string) {
    super(message);
    this.name = "PipelineActionConflictError";
    this.reason = reason;
  }
}

/** Trusted identity and pipeline identity required by every protected action. */
export interface PipelineActionInput {
  /** Pipeline identity from the validated route request. */
  readonly pipelineId: string;
  /** Authenticated user whose ownership limits the action. */
  readonly ownerUserId: string;
}

/** A safe result returned after the scheduler persisted a requested run. */
export interface EnqueuedPipelineRun {
  /** Number of initial Source jobs made available to workers. */
  readonly initialJobCount: number;
  /** Pipeline whose run was persisted. */
  readonly pipelineId: PipelineId;
  /** Whether another run must complete before this run can start. */
  readonly queuedBehindActiveRun: boolean;
  /** Stable identity assigned to the persisted run. */
  readonly runId: string;
}

/** Scheduler-owned enqueue operation used after this service confirms ownership. */
export type PipelineRunEnqueuer = (pipelineId: PipelineId) => Promise<EnqueuedPipelineRun>;

/** The persisted availability state after an allowed enable or disable action. */
export interface PipelineStateActionResult {
  /** Pipeline whose availability changed. */
  readonly pipelineId: PipelineId;
  /** Persisted availability state. */
  readonly state: PipelineState;
}

/**
 * Enqueue a manual pipeline run after confirming it belongs to the authenticated owner.
 *
 * The supplied enqueuer is scheduler-owned so creation retains its transactional queue
 * semantics instead of duplicating run persistence in the control-plane action layer.
 */
export async function runPipelineForOwner(
  db: DatabaseClient,
  input: PipelineActionInput,
  enqueueRun: PipelineRunEnqueuer,
): Promise<EnqueuedPipelineRun> {
  const identifiers = parseActionInput(input);
  const pipeline = await findOwnedPipeline(db, identifiers);

  if (!pipeline) {
    throw notFoundConflict();
  }

  assertPipelineCanRun(pipeline.state);

  try {
    return await enqueueRun(identifiers.pipelineId);
  } catch (error) {
    if (hasPipelineRunConflictReason(error, "not_enabled")) {
      throw notEnabledConflict();
    }

    if (hasPipelineRunConflictReason(error, "not_found")) {
      throw notFoundConflict();
    }

    throw error;
  }
}

/** Enable one idle pipeline after confirming it belongs to the authenticated owner. */
export async function enablePipelineForOwner(
  db: DatabaseClient,
  input: PipelineActionInput,
  now: Date = new Date(),
): Promise<PipelineStateActionResult> {
  return setPipelineStateForOwner(db, input, "enabled", now);
}

/** Disable one idle pipeline after confirming it belongs to the authenticated owner. */
export async function disablePipelineForOwner(
  db: DatabaseClient,
  input: PipelineActionInput,
  now: Date = new Date(),
): Promise<PipelineStateActionResult> {
  return setPipelineStateForOwner(db, input, "disabled", now);
}

/** Atomically apply a user-facing availability state after enforcing the execution lock. */
async function setPipelineStateForOwner(
  db: DatabaseClient,
  input: PipelineActionInput,
  state: Extract<PipelineState, "enabled" | "disabled">,
  now: Date,
): Promise<PipelineStateActionResult> {
  const identifiers = parseActionInput(input);

  return db.transaction(async (transaction) => {
    const [pipeline] = await transaction
      .select({ id: pipelines.id, state: pipelines.state })
      .from(pipelines)
      .where(and(eq(pipelines.id, identifiers.pipelineId), eq(pipelines.ownerUserId, identifiers.ownerUserId)))
      .for("update")
      .limit(1);

    if (!pipeline) {
      throw notFoundConflict();
    }

    const [blockingRun] = await transaction
      .select({ id: runs.id, state: runs.state })
      .from(runs)
      .where(and(eq(runs.pipelineId, identifiers.pipelineId), inArray(runs.state, activeRunStates)))
      .limit(1);

    const currentState = pipelineStateSchema.parse(pipeline.state) as PipelineState;
    try {
      setPipelineState(
        blockingRun
          ? {
            ...createPipelineExecutionState(currentState),
            activeRun: {
              cancellationRequested: false,
              id: blockingRun.id,
              state: blockingRun.state === "running" ? "running" : "queued",
            },
          }
          : createPipelineExecutionState(currentState),
        state,
      );
    } catch (error) {
      if (error instanceof PipelineStateTransitionError) {
        throw lockedConflict();
      }

      throw error;
    }

    await transaction
      .update(pipelines)
      .set({ state, updatedAt: now })
      .where(and(eq(pipelines.id, identifiers.pipelineId), eq(pipelines.ownerUserId, identifiers.ownerUserId)));

    return { pipelineId: identifiers.pipelineId, state };
  });
}

/** Parse route-boundary identifiers before they are used in owner-scoped queries. */
function parseActionInput(input: PipelineActionInput): { readonly pipelineId: PipelineId; readonly ownerUserId: UserId } {
  return {
    pipelineId: pipelineIdSchema.parse(input.pipelineId) as PipelineId,
    ownerUserId: userIdSchema.parse(input.ownerUserId) as UserId,
  };
}

/** Fetch only the minimal owner-scoped state required before passing work to the scheduler. */
async function findOwnedPipeline(
  db: DatabaseClient,
  input: { readonly pipelineId: PipelineId; readonly ownerUserId: UserId },
): Promise<{ readonly state: PipelineState } | undefined> {
  const [pipeline] = await db
    .select({ state: pipelines.state })
    .from(pipelines)
    .where(and(eq(pipelines.id, input.pipelineId), eq(pipelines.ownerUserId, input.ownerUserId)))
    .limit(1);

  if (!pipeline) {
    return undefined;
  }

  return { state: pipelineStateSchema.parse(pipeline.state) as PipelineState };
}

/** Apply the shared enabled-only state-machine rule before asking the scheduler to enqueue work. */
function assertPipelineCanRun(state: PipelineState): void {
  try {
    enqueuePipelineRun(createPipelineExecutionState(state), "manual-action");
  } catch (error) {
    if (error instanceof PipelineStateTransitionError) {
      throw notEnabledConflict();
    }

    throw error;
  }
}

/** Identify a scheduler conflict by its stable, cross-package reason value. */
function hasPipelineRunConflictReason(error: unknown, reason: "not_enabled" | "not_found"): boolean {
  return typeof error === "object"
    && error !== null
    && "reason" in error
    && error.reason === reason;
}

/** Preserve ownership privacy by treating inaccessible pipelines as absent. */
function notFoundConflict(): PipelineActionConflictError {
  return new PipelineActionConflictError("not_found", "The requested pipeline was not found.");
}

/** Return a route-safe conflict when a pipeline has not been enabled for execution. */
function notEnabledConflict(): PipelineActionConflictError {
  return new PipelineActionConflictError("not_enabled", "The pipeline must be enabled before it can run.");
}

/** Return a route-safe conflict when queued or executing work locks a pipeline. */
function lockedConflict(): PipelineActionConflictError {
  return new PipelineActionConflictError("locked", "The pipeline is locked while a run is queued or active.");
}
