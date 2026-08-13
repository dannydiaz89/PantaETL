import { pipelineSchema, type Pipeline } from "@pantaetl/contracts";
import { createPipelineExecutionState, type PipelineExecutionState } from "@pantaetl/pipeline";

/** Validates a control-plane pipeline payload at the web application boundary. */
export function parsePipeline(value: unknown): Pipeline {
  return pipelineSchema.parse(value) as Pipeline;
}

/** Converts a validated persisted pipeline into its shared execution domain state. */
export function getPipelineExecutionState(value: unknown): PipelineExecutionState {
  return createPipelineExecutionState(parsePipeline(value).state);
}
