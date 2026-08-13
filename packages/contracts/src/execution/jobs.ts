import { z } from "zod";

import {
  componentIdSchema,
  identifierSchema,
  jobIdSchema,
  pipelineIdSchema,
  runIdSchema,
} from "../common/identifiers.js";
import { timestampSchema } from "../common/primitives.js";
import { versionedContractSchema } from "../common/version.js";
import { componentConfigurationSchema } from "../pipeline/definition.js";
import { componentTypeSchema } from "../components/metadata.js";

/** Queue lifecycle states for individual execution jobs. */
export const jobStateSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);
export type JobState = z.infer<typeof jobStateSchema>;

/** Retry behavior that accompanies a queued job without coupling it to storage. */
export const retryPolicySchema = z.object({
  maxAttempts: z.number().int().positive(),
  retryDelaySeconds: z.number().int().nonnegative(),
});
export type RetryPolicy = z.infer<typeof retryPolicySchema>;

/** Wire-visible worker claim and heartbeat metadata. */
export const workerClaimSchema = z.object({
  workerId: identifierSchema,
  claimedAt: timestampSchema,
  heartbeatAt: timestampSchema,
});
export type WorkerClaim = z.infer<typeof workerClaimSchema>;

/** Cancellation request metadata propagated to queued or running work. */
export const cancellationRequestSchema = z.object({
  requestedAt: timestampSchema,
  requestedByUserId: identifierSchema.optional(),
});
export type CancellationRequest = z.infer<typeof cancellationRequestSchema>;

/** A queue job for one component step within a pipeline run. */
export const jobSchema = versionedContractSchema.extend({
  id: jobIdSchema,
  pipelineId: pipelineIdSchema,
  runId: runIdSchema,
  stepId: identifierSchema,
  componentId: componentIdSchema,
  state: jobStateSchema,
  attempt: z.number().int().nonnegative(),
  retryPolicy: retryPolicySchema,
  availableAt: timestampSchema,
  claim: workerClaimSchema.optional(),
  cancellation: cancellationRequestSchema.optional(),
  completedAt: timestampSchema.optional(),
});
export type Job = z.infer<typeof jobSchema>;

/**
 * Request sent to the worker for a Source step.
 *
 * Configuration carries portable values and secret binding references, never
 * usable secret values.
 */
export const sourceExecutionRequestSchema = versionedContractSchema
  .extend({
    jobId: jobIdSchema,
    pipelineId: pipelineIdSchema,
    runId: runIdSchema,
    stepId: identifierSchema,
    componentId: componentIdSchema,
    componentType: componentTypeSchema,
    componentVersion: z.string().regex(/^v\d+$/),
    configuration: componentConfigurationSchema,
  })
  .refine((request) => request.componentType.startsWith("source."), {
    message: "Source execution requests must reference a Source component type.",
    path: ["componentType"],
  });
export type SourceExecutionRequest = z.infer<typeof sourceExecutionRequestSchema>;
