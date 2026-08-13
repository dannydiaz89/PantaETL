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
