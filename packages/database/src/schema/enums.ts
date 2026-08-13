import { pgEnum } from "drizzle-orm/pg-core";

/** Persisted lifecycle states for a pipeline configuration. */
export const pipelineState = pgEnum("pipeline_state", ["draft", "enabled", "disabled"]);

/** Persisted types of configured pipeline components. */
export const componentKind = pgEnum("component_kind", ["source", "transform", "export"]);

/** Persisted ways that a pipeline can be triggered. */
export const triggerType = pgEnum("trigger_type", ["manual", "schedule"]);

/** Persisted lifecycle states for a pipeline execution. */
export const runState = pgEnum("run_state", [
  "queued",
  "running",
  "succeeded",
  "completed_with_warnings",
  "failed",
  "cancelled",
]);

/** Persisted lifecycle states for a component execution within a run. */
export const runStepState = pgEnum("run_step_state", [
  "queued",
  "running",
  "succeeded",
  "completed_with_warnings",
  "failed",
  "cancelled",
]);

/** Persisted lifecycle states for an execution job. */
export const jobState = pgEnum("job_state", ["queued", "running", "succeeded", "failed", "cancelled"]);

/** Persisted, payload-free lifecycle events emitted while a pipeline executes. */
export const operationalEventKind = pgEnum("operational_event_kind", [
  "run_queued",
  "run_started",
  "run_succeeded",
  "run_completed_with_warnings",
  "run_failed",
  "run_cancelled",
  "step_queued",
  "step_started",
  "step_succeeded",
  "step_completed_with_warnings",
  "step_failed",
  "step_cancelled",
  "job_claimed",
  "job_retried",
]);

/** Supported internal storage backends for retained artifacts. */
export const artifactStorageKind = pgEnum("artifact_storage_kind", ["local", "s3"]);
