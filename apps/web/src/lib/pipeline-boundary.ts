import { pipelineSchema, type Pipeline, type PipelineExecutionStateResponse } from "@pantaetl/contracts";
import { createPipelineExecutionState, type ActivePipelineRun, type PipelineExecutionState } from "@pantaetl/pipeline";

/** Validates a control-plane pipeline payload at the web application boundary. */
export function parsePipeline(value: unknown): Pipeline {
  return pipelineSchema.parse(value) as Pipeline;
}

/**
 * Converts a validated persisted pipeline into its shared execution domain state.
 *
 * `executionState` carries the pipeline's real queued-or-running run, if any; omitting it
 * (for example while that read is still loading) yields an idle state rather than a false lock.
 */
export function getPipelineExecutionState(
  value: unknown,
  executionState?: PipelineExecutionStateResponse,
): PipelineExecutionState {
  const pipelineState = parsePipeline(value).state;
  const activeRun: ActivePipelineRun | undefined = executionState?.activeRun === undefined
    ? undefined
    : { ...executionState.activeRun, cancellationRequested: false };

  return { ...createPipelineExecutionState(pipelineState), activeRun };
}
