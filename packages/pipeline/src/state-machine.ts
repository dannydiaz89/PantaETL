import type { PipelineState, Run } from "@pantaetl/contracts";

/** A queued or executing run that prevents pipeline configuration changes. */
export interface ActivePipelineRun {
  /** Stable run identifier assigned by the control plane. */
  readonly id: string;
  /** Execution phase before its terminal result is recorded. */
  readonly state: "queued" | "running";
  /** Whether the worker must stop the active run at its next safe boundary. */
  readonly cancellationRequested: boolean;
}

/** In-memory scheduling state for one pipeline. */
export interface PipelineExecutionState {
  /** User-controlled pipeline availability, separate from execution activity. */
  readonly pipelineState: PipelineState;
  /** The only run that may currently be queued or executing. */
  readonly activeRun: ActivePipelineRun | undefined;
  /** Later triggers waiting to become the active run in first-in, first-out order. */
  readonly queuedRunIds: readonly string[];
}

/** Run results that release the active-run lock and allow the next run to advance. */
export type PipelineTerminalRunState = Exclude<Run["state"], "queued" | "running">;

/** Error raised when an operation would violate a pipeline execution invariant. */
export class PipelineStateTransitionError extends Error {
  /** Explain which state-machine rule rejected the requested operation. */
  constructor(message: string) {
    super(message);
    this.name = "PipelineStateTransitionError";
  }
}

/** Create idle execution state for a pipeline in its configured availability state. */
export function createPipelineExecutionState(
  pipelineState: PipelineState = "draft",
): PipelineExecutionState {
  return { pipelineState, activeRun: undefined, queuedRunIds: [] };
}

/** Return whether pipeline configuration can change without affecting queued or active work. */
export function isPipelineEditable(state: PipelineExecutionState): boolean {
  return state.activeRun === undefined;
}

/**
 * Change a pipeline's configured availability while no execution work exists.
 *
 * A queued run locks configuration just like a running one because it will use
 * the pipeline definition captured by the control plane.
 */
export function setPipelineState(
  state: PipelineExecutionState,
  pipelineState: PipelineState,
): PipelineExecutionState {
  assertPipelineEditable(state);
  return { ...state, pipelineState };
}

/**
 * Add a triggered run while preserving one active run and a FIFO backlog.
 *
 * The first run becomes active in the queued phase. Later runs wait until the
 * active run has a terminal result.
 */
export function enqueuePipelineRun(
  state: PipelineExecutionState,
  runId: string,
): PipelineExecutionState {
  if (runId.length === 0) {
    throw new PipelineStateTransitionError("A pipeline run requires an identifier.");
  }

  if (containsRun(state, runId)) {
    throw new PipelineStateTransitionError("A run cannot be queued more than once.");
  }

  if (!state.activeRun) {
    return {
      ...state,
      activeRun: { id: runId, state: "queued", cancellationRequested: false },
    };
  }

  return { ...state, queuedRunIds: [...state.queuedRunIds, runId] };
}

/** Move the queued active run into execution. */
export function startActiveRun(state: PipelineExecutionState): PipelineExecutionState {
  const activeRun = requireActiveRun(state);

  if (activeRun.state !== "queued") {
    throw new PipelineStateTransitionError("Only a queued run can begin execution.");
  }

  if (activeRun.cancellationRequested) {
    throw new PipelineStateTransitionError("A cancelled run cannot begin execution.");
  }

  return { ...state, activeRun: { ...activeRun, state: "running" } };
}

/** Mark the active run for cooperative cancellation without releasing its execution lock. */
export function requestActiveRunCancellation(
  state: PipelineExecutionState,
): PipelineExecutionState {
  const activeRun = requireActiveRun(state);

  if (activeRun.cancellationRequested) {
    throw new PipelineStateTransitionError("Cancellation has already been requested.");
  }

  return { ...state, activeRun: { ...activeRun, cancellationRequested: true } };
}

/**
 * Record an active run's terminal result and promote one queued run, if present.
 *
 * The terminal result is intentionally not retained here; persistence and run
 * history own it. This state machine only controls serialization and editing.
 */
export function completeActiveRun(
  state: PipelineExecutionState,
  terminalState: PipelineTerminalRunState,
): PipelineExecutionState {
  requireActiveRun(state);

  if (!isTerminalRunState(terminalState)) {
    throw new PipelineStateTransitionError("Only a terminal run state can release a pipeline.");
  }

  const [nextRunId, ...remainingRunIds] = state.queuedRunIds;

  if (!nextRunId) {
    return { ...state, activeRun: undefined, queuedRunIds: [] };
  }

  return {
    ...state,
    activeRun: { id: nextRunId, state: "queued", cancellationRequested: false },
    queuedRunIds: remainingRunIds,
  };
}

/** Reject configuration changes while the pipeline has queued or active execution work. */
function assertPipelineEditable(state: PipelineExecutionState): void {
  if (!isPipelineEditable(state)) {
    throw new PipelineStateTransitionError(
      "Pipeline configuration is locked while a run is queued or active.",
    );
  }
}

/** Return the active run or fail with a consistent transition error. */
function requireActiveRun(state: PipelineExecutionState): ActivePipelineRun {
  if (!state.activeRun) {
    throw new PipelineStateTransitionError("The pipeline has no active run.");
  }

  return state.activeRun;
}

/** Determine whether a run identifier is already represented by this pipeline's execution state. */
function containsRun(state: PipelineExecutionState, runId: string): boolean {
  return state.activeRun?.id === runId || state.queuedRunIds.includes(runId);
}

/** Guard the release operation against non-terminal execution phases. */
function isTerminalRunState(state: Run["state"]): state is PipelineTerminalRunState {
  return state !== "queued" && state !== "running";
}
