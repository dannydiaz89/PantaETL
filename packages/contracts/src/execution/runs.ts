import type { Run } from "../generated/run.js";
import {
  arrayItemSchema,
  canonicalSchemas,
  propertySchema,
  zodFromJsonSchema,
} from "../json-schema.js";

const stepsSchema = propertySchema(canonicalSchemas.run, "steps");
const stepResultSchema = arrayItemSchema(stepsSchema);

/** Runtime validator derived from the canonical run result JSON Schema. */
export const runSchema = zodFromJsonSchema(canonicalSchemas.run);
export type { Run } from "../generated/run.js";

/** Runtime validator for pipeline run lifecycle states. */
export const runStateSchema = zodFromJsonSchema(propertySchema(canonicalSchemas.run, "state"));
export type RunState = Run["state"];

/** Runtime validator for a component execution step result. */
export const runStepResultSchema = zodFromJsonSchema(stepResultSchema);
export type RunStepResult = Run["steps"][number];

/** Runtime validator for component execution step lifecycle states. */
export const runStepStateSchema = zodFromJsonSchema(propertySchema(stepResultSchema, "state"));
export type RunStepState = RunStepResult["state"];

/** Runtime validator for safe execution counters. */
export const executionMetricsSchema = zodFromJsonSchema(
  propertySchema(stepResultSchema, "metrics"),
);
export type ExecutionMetrics = RunStepResult["metrics"];

/** Runtime validator for safe execution error context. */
export const executionErrorSchema = zodFromJsonSchema(
  propertySchema(stepResultSchema, "error"),
);
export type ExecutionError = NonNullable<RunStepResult["error"]>;
