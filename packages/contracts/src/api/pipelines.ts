import { z } from "zod";

import {
  contractVersionSchema,
  pipelineIdSchema,
  runIdSchema,
  type PipelineId,
  type RunId,
} from "../common/index.js";
import { canonicalSchemas, propertySchema, zodFromJsonSchema } from "../json-schema.js";
import {
  pipelineEdgeSchema,
  pipelineSchema,
  pipelineStateSchema,
  pipelineStepSchema,
  type Pipeline,
  type Trigger,
} from "../pipeline/index.js";

const pipelineNameSchema = zodFromJsonSchema(
  propertySchema(canonicalSchemas.pipeline, "name"),
) as z.ZodType<Pipeline["name"]>;
const pipelineContractVersionSchema = contractVersionSchema as z.ZodType<Pipeline["contractVersion"]>;
const pipelineEdgeInputSchema = pipelineEdgeSchema as z.ZodType<Pipeline["edges"][number]>;
const pipelineStateInputSchema = pipelineStateSchema as z.ZodType<Pipeline["state"]>;
const pipelineStepInputSchema = pipelineStepSchema as z.ZodType<Pipeline["steps"][number]>;

const writablePipelineTriggerSchema = z.discriminatedUnion("type", [
  z.strictObject({ enabled: z.boolean(), type: z.literal("manual") }),
  z.strictObject({
    cron: z.string().min(1),
    enabled: z.boolean(),
    timezone: z.string().min(1),
    type: z.literal("schedule"),
  }),
]) as z.ZodType<WritablePipelineTrigger>;

/** A request with no query or body fields for the current owner-scoped pipeline list. */
export type PipelineListRequest = Record<string, never>;

/** The owner-scoped pipeline collection returned by the control plane. */
export interface PipelineListResponse {
  readonly pipelines: readonly Pipeline[];
}

/** Trigger input that the control plane assigns to its newly created pipeline. */
export type WritablePipelineTrigger =
  | Omit<Extract<Trigger, { type: "manual" }>, "id" | "pipelineId">
  | Omit<Extract<Trigger, { type: "schedule" }>, "id" | "pipelineId">;

/** Pipeline graph input accepted on creation without caller-controlled ownership or timestamps. */
export interface PipelineCreateRequest {
  readonly contractVersion: Pipeline["contractVersion"];
  readonly edges: readonly Pipeline["edges"][number][];
  readonly name: Pipeline["name"];
  readonly steps: readonly Pipeline["steps"][number][];
  readonly triggers: readonly WritablePipelineTrigger[];
}

/** Canonical persisted pipeline returned after a successful create operation. */
export type PipelineCreateResponse = Pipeline;

/** Owner-scoped resource identity used by detail, delete, and action operations. */
export interface PipelineDetailRequest {
  readonly pipelineId: PipelineId;
}

/** Canonical persisted pipeline returned by an owner-scoped detail operation. */
export type PipelineDetailResponse = Pipeline;

/** Mutable pipeline fields; ownership, identity, and lifecycle timestamps remain server-controlled. */
export interface PipelineUpdateRequest {
  readonly edges?: readonly Pipeline["edges"][number][];
  readonly name?: Pipeline["name"];
  readonly state?: Pipeline["state"];
  readonly steps?: readonly Pipeline["steps"][number][];
  readonly triggers?: readonly WritablePipelineTrigger[];
}

/** Canonical persisted pipeline returned after an atomic update operation. */
export type PipelineUpdateResponse = Pipeline;

/** Owner-scoped resource identity used to delete a pipeline. */
export type PipelineDeleteRequest = PipelineDetailRequest;

/** Owner-scoped duplicate request with an optional replacement display name. */
export interface PipelineDuplicateRequest extends PipelineDetailRequest {
  readonly name?: Pipeline["name"];
}

/** Canonical draft pipeline returned after duplication clears usable credentials. */
export type PipelineDuplicateResponse = Pipeline;

/** Owner-scoped request to enqueue a manually triggered pipeline run. */
export type PipelineRunRequest = PipelineDetailRequest;

/** Safe scheduling result returned after a pipeline run has been persisted. */
export interface PipelineRunResponse {
  readonly initialJobCount: number;
  readonly pipelineId: PipelineId;
  readonly queuedBehindActiveRun: boolean;
  readonly runId: RunId;
}

/** Owner-scoped request to enable or disable a pipeline. */
export type PipelineStateActionRequest = PipelineDetailRequest;

/** Canonical persisted pipeline returned after an allowed state transition. */
export type PipelineStateActionResponse = Pipeline;

/** Validate an owner-scoped list request. */
export const pipelineListRequestSchema = z.strictObject({}) as z.ZodType<PipelineListRequest>;

/** Validate a pipeline collection response before it reaches an API consumer. */
export const pipelineListResponseSchema = z.strictObject({
  pipelines: z.array(pipelineSchema as z.ZodType<Pipeline>),
}) as z.ZodType<PipelineListResponse>;

/** Validate pipeline creation input without accepting owner, pipeline ID, or timestamps. */
export const pipelineCreateRequestSchema = z.strictObject({
  contractVersion: pipelineContractVersionSchema,
  edges: z.array(pipelineEdgeInputSchema),
  name: pipelineNameSchema,
  steps: z.array(pipelineStepInputSchema).min(1),
  triggers: z.array(writablePipelineTriggerSchema),
}) as z.ZodType<PipelineCreateRequest>;

/** Validate the canonical pipeline returned after creation. */
export const pipelineCreateResponseSchema = pipelineSchema as z.ZodType<PipelineCreateResponse>;

/** Validate an owner-scoped pipeline detail request. */
export const pipelineDetailRequestSchema = z.strictObject({
  pipelineId: pipelineIdSchema,
}) as z.ZodType<PipelineDetailRequest>;

/** Validate the canonical pipeline returned by a detail request. */
export const pipelineDetailResponseSchema = pipelineSchema as z.ZodType<PipelineDetailResponse>;

/** Validate mutable pipeline input while rejecting owner, ID, and timestamp rewrites. */
export const pipelineUpdateRequestSchema = z.strictObject({
  edges: z.array(pipelineEdgeInputSchema).optional(),
  name: pipelineNameSchema.optional(),
  state: pipelineStateInputSchema.optional(),
  steps: z.array(pipelineStepInputSchema).min(1).optional(),
  triggers: z.array(writablePipelineTriggerSchema).optional(),
}).refine((request) => Object.keys(request).length > 0) as z.ZodType<PipelineUpdateRequest>;

/** Validate the canonical pipeline returned after an update. */
export const pipelineUpdateResponseSchema = pipelineSchema as z.ZodType<PipelineUpdateResponse>;

/** Validate an owner-scoped pipeline deletion request. */
export const pipelineDeleteRequestSchema = pipelineDetailRequestSchema;

/** Validate a pipeline duplication request without allowing caller-controlled ownership. */
export const pipelineDuplicateRequestSchema = z.strictObject({
  name: pipelineNameSchema.optional(),
  pipelineId: pipelineIdSchema,
}) as z.ZodType<PipelineDuplicateRequest>;

/** Validate the canonical draft pipeline returned after duplication. */
export const pipelineDuplicateResponseSchema = pipelineSchema as z.ZodType<PipelineDuplicateResponse>;

/** Validate a request to enqueue one manually triggered pipeline run. */
export const pipelineRunRequestSchema = pipelineDetailRequestSchema;

/** Validate the safe run-queue result returned after manual triggering. */
export const pipelineRunResponseSchema = z.strictObject({
  initialJobCount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  pipelineId: pipelineIdSchema,
  queuedBehindActiveRun: z.boolean(),
  runId: runIdSchema,
}) as z.ZodType<PipelineRunResponse>;

/** Validate an owner-scoped enable or disable request. */
export const pipelineStateActionRequestSchema = pipelineDetailRequestSchema;

/** Validate the canonical pipeline returned after an enable or disable action. */
export const pipelineStateActionResponseSchema = pipelineSchema as z.ZodType<PipelineStateActionResponse>;
