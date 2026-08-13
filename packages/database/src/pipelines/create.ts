import {
  pipelineCreateRequestSchema,
  userIdSchema,
  type Pipeline,
  type PipelineCreateRequest,
  type UserId,
} from "@pantaetl/contracts";
import { buildPipelineTopology, type PipelineTopologyInput } from "@pantaetl/pipeline";

import type { DatabaseClient } from "../client.js";
import { hydratePipeline } from "./hydration.js";
import { pipelineComponents, pipelineEdges, pipelines, pipelineTriggers } from "../schema/pipelines.js";

/** Trusted caller identity and untrusted graph input used to create a pipeline. */
export interface CreatePipelineInput {
  /** Authenticated user who will own the new pipeline. */
  readonly ownerUserId: UserId;
  /** Validated graph fields that exclude owner, lifecycle, and persistence identifiers. */
  readonly pipeline: PipelineCreateRequest;
}

/** Raised when a contract-valid graph cannot form a valid Source-to-Export pipeline. */
export class InvalidPipelineTopologyError extends Error {
  /** Explain the graph invariant that prevented persistence. */
  constructor(message: string) {
    super(message);
    this.name = "InvalidPipelineTopologyError";
  }
}

/**
 * Persist a complete pipeline graph in one database transaction.
 *
 * The owner is accepted separately from a trusted authentication boundary so
 * caller-controlled request data cannot create a pipeline for another user.
 */
export async function createPipeline(
  db: DatabaseClient,
  input: CreatePipelineInput,
): Promise<Pipeline> {
  const ownerUserId = userIdSchema.parse(input.ownerUserId) as UserId;
  const request = pipelineCreateRequestSchema.parse(input.pipeline) as PipelineCreateRequest;
  validatePipelineGraph(request);

  return db.transaction(async (transaction) => {
    const [persistedPipeline] = await transaction
      .insert(pipelines)
      .values({
        contractVersion: request.contractVersion,
        name: request.name,
        ownerUserId,
        state: "draft",
      })
      .returning();

    if (!persistedPipeline) {
      throw new Error("Pipeline creation did not return a persisted pipeline.");
    }

    const persistedComponents = await transaction
      .insert(pipelineComponents)
      .values(
        request.steps.map((step) => ({
          componentType: step.componentType,
          componentVersion: step.componentVersion,
          configurationValues: step.configuration.values,
          id: step.id,
          kind: step.kind,
          pipelineId: persistedPipeline.id,
          secretBindings: step.configuration.secretBindings,
        })),
      )
      .returning();

    const persistedEdges = request.edges.length === 0
      ? []
      : await transaction
        .insert(pipelineEdges)
        .values(
          request.edges.map((edge) => ({
            fromComponentId: edge.fromStepId,
            pipelineId: persistedPipeline.id,
            toComponentId: edge.toStepId,
          })),
        )
        .returning();

    const persistedTriggers = request.triggers.length === 0
      ? []
      : await transaction
        .insert(pipelineTriggers)
        .values(
          request.triggers.map((trigger) => (
            trigger.type === "manual"
              ? {
                enabled: trigger.enabled,
                pipelineId: persistedPipeline.id,
                type: trigger.type,
              }
              : {
                cron: trigger.cron,
                enabled: trigger.enabled,
                pipelineId: persistedPipeline.id,
                timezone: trigger.timezone,
                type: trigger.type,
              }
          )),
        )
        .returning();

    return hydratePipeline({
      components: persistedComponents,
      edges: persistedEdges,
      pipeline: persistedPipeline,
      triggers: persistedTriggers,
    }) as Pipeline;
  });
}

/** Validate graph connectivity and component direction before opening a write transaction. */
function validatePipelineGraph(request: PipelineCreateRequest): void {
  const topology = buildPipelineTopology({
    edges: [...request.edges],
    steps: [...request.steps] as PipelineTopologyInput["steps"],
  });
  const stepIds = new Set<string>();
  const incomingStepIds = new Set<string>();
  const outgoingStepIds = new Set<string>();
  const edgeKeys = new Set<string>();

  for (const step of request.steps) {
    if (stepIds.has(step.id)) {
      throw new InvalidPipelineTopologyError("Pipeline steps must have unique identifiers.");
    }

    stepIds.add(step.id);
  }

  for (const edge of request.edges) {
    if (!topology.stepsById.has(edge.fromStepId) || !topology.stepsById.has(edge.toStepId)) {
      throw new InvalidPipelineTopologyError("Pipeline edges must reference existing steps.");
    }

    if (edge.fromStepId === edge.toStepId) {
      throw new InvalidPipelineTopologyError("Pipeline steps cannot connect to themselves.");
    }

    const edgeKey = `${edge.fromStepId}:${edge.toStepId}`;
    if (edgeKeys.has(edgeKey)) {
      throw new InvalidPipelineTopologyError("Pipeline edges must be unique.");
    }

    edgeKeys.add(edgeKey);
    incomingStepIds.add(edge.toStepId);
    outgoingStepIds.add(edge.fromStepId);

    const upstream = topology.stepsById.get(edge.fromStepId);
    const downstream = topology.stepsById.get(edge.toStepId);
    if (!upstream || !downstream) {
      throw new InvalidPipelineTopologyError("Pipeline edges must reference existing steps.");
    }

    if (upstream.kind === "export" || downstream.kind === "source") {
      throw new InvalidPipelineTopologyError("Pipeline edges must flow from Source through Transform to Export.");
    }
  }

  const sources = request.steps.filter((step) => step.kind === "source");
  const exports = request.steps.filter((step) => step.kind === "export");

  if (sources.length === 0 || exports.length === 0) {
    throw new InvalidPipelineTopologyError("A pipeline requires at least one Source and one Export.");
  }

  for (const source of sources) {
    if (incomingStepIds.has(source.id)) {
      throw new InvalidPipelineTopologyError("A Source cannot receive input from another component.");
    }
  }

  for (const output of exports) {
    if (outgoingStepIds.has(output.id)) {
      throw new InvalidPipelineTopologyError("An Export cannot provide output to another component.");
    }
  }

  for (const step of request.steps) {
    if (step.kind === "source" && !outgoingStepIds.has(step.id)) {
      throw new InvalidPipelineTopologyError("Every Source must produce data for another component.");
    }

    if (step.kind === "transform" && (!incomingStepIds.has(step.id) || !outgoingStepIds.has(step.id))) {
      throw new InvalidPipelineTopologyError("Every Transform must receive and produce data.");
    }

    if (step.kind === "export" && !incomingStepIds.has(step.id)) {
      throw new InvalidPipelineTopologyError("Every Export must receive data from another component.");
    }
  }

  assertGraphConnectsSourcesToExports(topology, sources.map((step) => step.id), exports.map((step) => step.id));
}

/** Ensure every component participates in a directed, acyclic source-to-export path. */
function assertGraphConnectsSourcesToExports(
  topology: ReturnType<typeof buildPipelineTopology>,
  sourceIds: readonly string[],
  exportIds: readonly string[],
): void {
  const reachableFromSources = visitGraph(sourceIds, (stepId) => topology.outgoingEdgesByStepId.get(stepId) ?? []);
  const reachableToExports = visitGraph(exportIds, (stepId) => topology.incomingEdgesByStepId.get(stepId) ?? []);

  for (const stepId of topology.stepsById.keys()) {
    if (!reachableFromSources.has(stepId) || !reachableToExports.has(stepId)) {
      throw new InvalidPipelineTopologyError("Every component must connect a Source to an Export.");
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  for (const sourceId of sourceIds) assertNoCycle(sourceId, topology, visiting, visited);
}

/** Traverse an edge direction from a set of initial component identifiers. */
function visitGraph(
  initialStepIds: readonly string[],
  edgesForStep: (stepId: string) => readonly { readonly fromStepId: string; readonly toStepId: string }[],
): Set<string> {
  const visited = new Set<string>();
  const pending = [...initialStepIds];

  while (pending.length > 0) {
    const stepId = pending.pop();
    if (!stepId || visited.has(stepId)) continue;
    visited.add(stepId);

    for (const edge of edgesForStep(stepId)) {
      pending.push(edge.fromStepId === stepId ? edge.toStepId : edge.fromStepId);
    }
  }

  return visited;
}

/** Reject cycles so a graph can always make forward progress from its Sources. */
function assertNoCycle(
  stepId: string,
  topology: ReturnType<typeof buildPipelineTopology>,
  visiting: Set<string>,
  visited: Set<string>,
): void {
  if (visiting.has(stepId)) {
    throw new InvalidPipelineTopologyError("Pipeline graphs cannot contain cycles.");
  }

  if (visited.has(stepId)) return;
  visiting.add(stepId);
  for (const edge of topology.outgoingEdgesByStepId.get(stepId) ?? []) {
    assertNoCycle(edge.toStepId, topology, visiting, visited);
  }
  visiting.delete(stepId);
  visited.add(stepId);
}
