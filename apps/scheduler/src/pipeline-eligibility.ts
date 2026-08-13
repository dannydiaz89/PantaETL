import { pipelineStateSchema, type PipelineState } from "@pantaetl/contracts";
import { createPipelineExecutionState } from "@pantaetl/pipeline";

/** Result of checking whether a persisted pipeline may receive scheduled work. */
export type PipelineSchedulingEligibility = "eligible" | "ineligible" | "invalid";

/**
 * Converts a persisted pipeline state into the scheduler's safe eligibility decision.
 *
 * Only enabled pipelines may receive a scheduled run. The pipeline domain state is
 * constructed here so scheduling follows the same contract boundary as execution.
 */
export function getPipelineSchedulingEligibility(state: unknown): PipelineSchedulingEligibility {
  const parsedState = pipelineStateSchema.safeParse(state);

  if (!parsedState.success) {
    return "invalid";
  }

  const executionState = createPipelineExecutionState(parsedState.data as PipelineState);
  return executionState.pipelineState === "enabled" ? "eligible" : "ineligible";
}
