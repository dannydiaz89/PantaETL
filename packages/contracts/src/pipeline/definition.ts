import { z } from "zod";

import {
  identifierSchema,
  pipelineIdSchema,
  userIdSchema,
} from "../common/identifiers.js";
import { timestampSchema, versionSchema } from "../common/primitives.js";
import { versionedContractSchema } from "../common/version.js";
import { componentKindSchema, componentTypeSchema } from "../components/metadata.js";

/** States that control whether a pipeline can be triggered. */
export const pipelineStateSchema = z.enum(["draft", "enabled", "disabled"]);
export type PipelineState = z.infer<typeof pipelineStateSchema>;

/** Reference to a secret re-bound by the target deployment. */
export const secretBindingSchema = z.object({
  key: z.string().min(1),
  binding: z.string().min(1),
});
export type SecretBinding = z.infer<typeof secretBindingSchema>;

const sensitiveConfigKeyPattern = /(?:api[_-]?key|authorization|credential|password|secret|token)/i;

/**
 * Portable, non-secret component configuration.
 *
 * Secret-bearing fields are represented by bindings only. Rejecting sensitive
 * value keys prevents exported pipeline definitions from carrying usable
 * credentials in ordinary configuration.
 */
export const componentConfigurationSchema = z
  .object({
    values: z.record(z.string(), z.json()),
    secretBindings: z.array(secretBindingSchema),
  })
  .superRefine((configuration, context) => {
    const visit = (value: unknown, path: (string | number)[]): void => {
      if (Array.isArray(value)) {
        value.forEach((item, index) => visit(item, [...path, index]));
        return;
      }

      if (typeof value !== "object" || value === null) {
        return;
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        if (sensitiveConfigKeyPattern.test(key)) {
          context.addIssue({
            code: "custom",
            message: "Portable configuration must use secretBindings for secret fields.",
            path: ["values", ...path, key],
          });
        }
        visit(nestedValue, [...path, key]);
      }
    };

    visit(configuration.values, []);
  });
export type ComponentConfiguration = z.infer<typeof componentConfigurationSchema>;

/** One Source, Transform, or Export node in a portable pipeline graph. */
export const pipelineStepSchema = z.object({
  id: identifierSchema,
  kind: componentKindSchema,
  componentType: componentTypeSchema,
  componentVersion: versionSchema,
  configuration: componentConfigurationSchema,
});
export type PipelineStep = z.infer<typeof pipelineStepSchema>;

/** Directed edge linking two component steps in the pipeline graph. */
export const pipelineEdgeSchema = z
  .object({
    fromStepId: identifierSchema,
    toStepId: identifierSchema,
  })
  .refine((edge) => edge.fromStepId !== edge.toStepId, {
    message: "Pipeline edges cannot connect a step to itself.",
  });
export type PipelineEdge = z.infer<typeof pipelineEdgeSchema>;

/** Manual trigger configuration kept separate from the pipeline data chain. */
export const manualTriggerSchema = z.object({
  id: identifierSchema,
  pipelineId: pipelineIdSchema,
  type: z.literal("manual"),
  enabled: z.boolean(),
});
export type ManualTrigger = z.infer<typeof manualTriggerSchema>;

/** Schedule configuration owned by a pipeline. */
export const scheduleTriggerSchema = z.object({
  id: identifierSchema,
  pipelineId: pipelineIdSchema,
  type: z.literal("schedule"),
  enabled: z.boolean(),
  cron: z.string().min(1),
  timezone: z.string().min(1),
});
export type ScheduleTrigger = z.infer<typeof scheduleTriggerSchema>;

/** Trigger that starts a pipeline without becoming a pipeline data component. */
export const triggerSchema = z.discriminatedUnion("type", [
  manualTriggerSchema,
  scheduleTriggerSchema,
]);
export type Trigger = z.infer<typeof triggerSchema>;

/** Portable pipeline structure containing graph nodes and pipeline-owned triggers. */
export const pipelineSchema = versionedContractSchema
  .extend({
    id: pipelineIdSchema,
    ownerUserId: userIdSchema,
    name: z.string().min(1),
    state: pipelineStateSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    steps: z.array(pipelineStepSchema).min(1),
    edges: z.array(pipelineEdgeSchema),
    triggers: z.array(triggerSchema),
  })
  .superRefine((pipeline, context) => {
    if (!pipeline.steps.some((step) => step.kind === "source")) {
      context.addIssue({
        code: "custom",
        message: "A pipeline requires a Source step.",
        path: ["steps"],
      });
    }

    if (!pipeline.steps.some((step) => step.kind === "export")) {
      context.addIssue({
        code: "custom",
        message: "A pipeline requires an Export step.",
        path: ["steps"],
      });
    }

    const stepIds = new Set(pipeline.steps.map((step) => step.id));
    pipeline.edges.forEach((edge, index) => {
      if (!stepIds.has(edge.fromStepId) || !stepIds.has(edge.toStepId)) {
        context.addIssue({
          code: "custom",
          message: "Pipeline edges must reference declared steps.",
          path: ["edges", index],
        });
      }
    });

    pipeline.triggers.forEach((trigger, index) => {
      if (trigger.pipelineId !== pipeline.id) {
        context.addIssue({
          code: "custom",
          message: "Pipeline triggers must reference their owning pipeline.",
          path: ["triggers", index, "pipelineId"],
        });
      }
    });
  });
export type Pipeline = z.infer<typeof pipelineSchema>;
