import type { Job } from "../generated/job.js";
import {
  canonicalSchemas,
  propertySchema,
  zodFromJsonSchema,
} from "../json-schema.js";

const jobClaimSchema = propertySchema(canonicalSchemas.job, "claim");
const jobCancellationSchema = propertySchema(canonicalSchemas.job, "cancellation");

/** Runtime validator derived from the canonical queue job JSON Schema. */
export const jobSchema = zodFromJsonSchema(canonicalSchemas.job);
export type { Job } from "../generated/job.js";

/** Runtime validator for queue lifecycle states. */
export const jobStateSchema = zodFromJsonSchema(propertySchema(canonicalSchemas.job, "state"));
export type JobState = Job["state"];

/** Runtime validator for queue retry policy metadata. */
export const retryPolicySchema = zodFromJsonSchema(
  propertySchema(canonicalSchemas.job, "retryPolicy"),
);
export type RetryPolicy = Job["retryPolicy"];

/** Runtime validator for worker claim and heartbeat metadata. */
export const workerClaimSchema = zodFromJsonSchema(jobClaimSchema);
export type WorkerClaim = NonNullable<Job["claim"]>;

/** Runtime validator for job cancellation metadata. */
export const cancellationRequestSchema = zodFromJsonSchema(jobCancellationSchema);
export type CancellationRequest = NonNullable<Job["cancellation"]>;

/** Runtime validator derived from the canonical Source execution request JSON Schema. */
export const sourceExecutionRequestSchema = zodFromJsonSchema(
  canonicalSchemas.sourceExecutionRequest,
);
export type { SourceExecutionRequest } from "../generated/source-execution-request.js";
