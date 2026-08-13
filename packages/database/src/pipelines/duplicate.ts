import { randomUUID } from "node:crypto";

import {
  pipelineDuplicateRequestSchema,
  userIdSchema,
  type Pipeline,
  type PipelineCreateRequest,
  type PipelineDuplicateRequest,
  type PipelineId,
  type UserId,
  type WritablePipelineTrigger,
} from "@pantaetl/contracts";
import { duplicatePipelineDefinition } from "@pantaetl/pipeline";

import type { DatabaseClient } from "../client.js";
import { createPipeline } from "./create.js";
import { getPipeline } from "./read.js";

/** Trusted owner context and optional display name for a pipeline copy. */
export interface DuplicatePipelineInput {
  /** Authenticated user who must own both the source and duplicated pipeline. */
  readonly ownerUserId: UserId;
  /** Owner-scoped pipeline identity to copy. */
  readonly pipelineId: PipelineId;
  /** Optional name to assign to the newly created pipeline. */
  readonly name?: string;
}

/** Creates a fresh component identifier while duplicating a pipeline graph. */
type ComponentIdGenerator = () => string;

/**
 * Creates a draft copy of an owner-scoped pipeline with new graph identities.
 *
 * The copy retains only contract-safe configuration values. Credential binding
 * references are removed, copied triggers are disabled, and the create path
 * initializes all schedule runtime metadata for the new pipeline.
 */
export async function duplicatePipeline(
  db: DatabaseClient,
  input: DuplicatePipelineInput,
  createComponentId: ComponentIdGenerator = randomUUID,
): Promise<Pipeline | undefined> {
  const ownerUserId = userIdSchema.parse(input.ownerUserId) as UserId;
  const request = pipelineDuplicateRequestSchema.parse({
    name: input.name,
    pipelineId: input.pipelineId,
  }) as PipelineDuplicateRequest;
  const source = await getPipeline(db, {
    ownerUserId,
    pipelineId: request.pipelineId,
  });

  if (!source) {
    return undefined;
  }

  const definition = duplicatePipelineDefinition(source, request.name ?? source.name);
  return createPipeline(db, {
    ownerUserId,
    pipeline: buildDuplicateCreateRequest(source, definition, createComponentId),
  });
}

/** Build a new writable graph with component identifiers remapped consistently. */
function buildDuplicateCreateRequest(
  source: Pipeline,
  definition: ReturnType<typeof duplicatePipelineDefinition>,
  createComponentId: ComponentIdGenerator,
): PipelineCreateRequest {
  const componentIdBySourceId = new Map<string, string>();
  const steps = definition.steps.map((step) => {
    const id = createComponentId();
    componentIdBySourceId.set(step.id, id);

    return { ...step, id };
  });

  return {
    contractVersion: definition.contractVersion,
    edges: definition.edges.map((edge) => ({
      fromStepId: remapComponentId(componentIdBySourceId, edge.fromStepId),
      toStepId: remapComponentId(componentIdBySourceId, edge.toStepId),
    })),
    name: definition.name,
    steps,
    triggers: source.triggers.map(copyDisabledTrigger),
  };
}

/** Resolve one existing graph identity to its newly generated component identity. */
function remapComponentId(componentIdBySourceId: ReadonlyMap<string, string>, sourceId: string): string {
  const id = componentIdBySourceId.get(sourceId);
  if (!id) {
    throw new Error("Pipeline edge references a component that is absent from its graph.");
  }

  return id;
}

/** Copy the trigger definition without preserving enabled state or runtime scheduling state. */
function copyDisabledTrigger(trigger: Pipeline["triggers"][number]): WritablePipelineTrigger {
  if (trigger.type === "manual") {
    return { enabled: false, type: "manual" };
  }

  return {
    cron: trigger.cron,
    enabled: false,
    timezone: trigger.timezone,
    type: "schedule",
  };
}
