import { z } from "zod";

import {
  componentIdSchema,
  identifierSchema,
  pipelineIdSchema,
  runIdSchema,
} from "../common/identifiers.js";
import { timestampSchema } from "../common/primitives.js";
import { versionedContractSchema } from "../common/version.js";

/** Lifecycle states for an entire pipeline run. */
export const runStateSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "completed_with_warnings",
  "failed",
  "cancelled",
]);
export type RunState = z.infer<typeof runStateSchema>;

/** Lifecycle states for a component execution step. */
export const runStepStateSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "completed_with_warnings",
  "failed",
  "cancelled",
]);
export type RunStepState = z.infer<typeof runStepStateSchema>;

/** Safe execution counters retained with a step result. */
export const executionMetricsSchema = z.object({
  recordsRead: z.number().int().nonnegative().optional(),
  recordsWritten: z.number().int().nonnegative().optional(),
  bytesRead: z.number().int().nonnegative().optional(),
  bytesWritten: z.number().int().nonnegative().optional(),
  durationMilliseconds: z.number().int().nonnegative().optional(),
});
export type ExecutionMetrics = z.infer<typeof executionMetricsSchema>;

/** Safe failure context that excludes records, headers, and secret values. */
export const executionErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  field: z.string().min(1).optional(),
  rowIndex: z.number().int().nonnegative().optional(),
});
export type ExecutionError = z.infer<typeof executionErrorSchema>;

/** Result metadata for one pipeline component step. */
export const runStepResultSchema = z.object({
  stepId: identifierSchema,
  componentId: componentIdSchema,
  state: runStepStateSchema,
  startedAt: timestampSchema.optional(),
  completedAt: timestampSchema.optional(),
  warningCount: z.number().int().nonnegative(),
  metrics: executionMetricsSchema,
  error: executionErrorSchema.optional(),
});
export type RunStepResult = z.infer<typeof runStepResultSchema>;

/** ORM-independent summary and terminal result of a pipeline run. */
export const runSchema = versionedContractSchema.extend({
  id: runIdSchema,
  pipelineId: pipelineIdSchema,
  state: runStateSchema,
  createdAt: timestampSchema,
  startedAt: timestampSchema.optional(),
  completedAt: timestampSchema.optional(),
  cancellationRequestedAt: timestampSchema.optional(),
  warningCount: z.number().int().nonnegative(),
  steps: z.array(runStepResultSchema),
});
export type Run = z.infer<typeof runSchema>;
