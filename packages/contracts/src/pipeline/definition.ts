import type { Pipeline } from "../generated/pipeline.js";
import {
  arrayItemSchema,
  canonicalSchemas,
  propertySchema,
  zodFromJsonSchema,
} from "../json-schema.js";

const stepsSchema = propertySchema(canonicalSchemas.pipeline, "steps");
const stepSchema = arrayItemSchema(stepsSchema);
const edgesSchema = propertySchema(canonicalSchemas.pipeline, "edges");
const triggersSchema = propertySchema(canonicalSchemas.pipeline, "triggers");
const configurationSchema = propertySchema(stepSchema, "configuration");
const secretBindingsSchema = propertySchema(configurationSchema, "secretBindings");

/** Runtime validator derived from the canonical portable pipeline JSON Schema. */
export const pipelineSchema = zodFromJsonSchema(canonicalSchemas.pipeline);
export type { Pipeline } from "../generated/pipeline.js";

/** Runtime validator for pipeline activation states. */
export const pipelineStateSchema = zodFromJsonSchema(
  propertySchema(canonicalSchemas.pipeline, "state"),
);
export type PipelineState = Pipeline["state"];

/** Runtime validator for one Source, Transform, or Export graph node. */
export const pipelineStepSchema = zodFromJsonSchema(stepSchema);
export type PipelineStep = Pipeline["steps"][number];

/** Runtime validator for directed edges in the pipeline graph. */
export const pipelineEdgeSchema = zodFromJsonSchema(arrayItemSchema(edgesSchema));
export type PipelineEdge = Pipeline["edges"][number];

/** Runtime validator for portable component values and secret references. */
export const componentConfigurationSchema = zodFromJsonSchema(configurationSchema);
export type ComponentConfiguration = PipelineStep["configuration"];

/** Runtime validator for secret re-binding metadata. */
export const secretBindingSchema = zodFromJsonSchema(arrayItemSchema(secretBindingsSchema));
export type SecretBinding = ComponentConfiguration["secretBindings"][number];

/** Runtime validator for manual or schedule trigger configuration. */
export const triggerSchema = zodFromJsonSchema(arrayItemSchema(triggersSchema));
export type Trigger = Pipeline["triggers"][number];

/** Runtime validator for manual trigger configuration. */
export const manualTriggerSchema = triggerSchema;
export type ManualTrigger = Extract<Trigger, { type: "manual" }>;

/** Runtime validator for schedule trigger configuration. */
export const scheduleTriggerSchema = triggerSchema;
export type ScheduleTrigger = Extract<Trigger, { type: "schedule" }>;
