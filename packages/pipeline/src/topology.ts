import type { Pipeline, PipelineEdge, PipelineStep } from "@pantaetl/contracts";

/** Contract-backed pipeline fields needed to navigate a pipeline graph. */
export type PipelineTopologyInput = Pick<Pipeline, "steps" | "edges">;

/** Indexed graph representation used by pure pipeline-domain rules. */
export interface PipelineTopology {
  /** Steps indexed by their stable pipeline-local identifier. */
  readonly stepsById: ReadonlyMap<string, PipelineStep>;
  /** Edges grouped by the step that produces data for them. */
  readonly outgoingEdgesByStepId: ReadonlyMap<string, readonly PipelineEdge[]>;
  /** Edges grouped by the step that consumes data from them. */
  readonly incomingEdgesByStepId: ReadonlyMap<string, readonly PipelineEdge[]>;
}

/**
 * Build immutable-view indexes for a contract-validated pipeline graph.
 *
 * The function deliberately does not decide whether a graph is valid; contract
 * and domain validation own that responsibility. It only provides efficient,
 * persistence-independent navigation for later pipeline rules.
 */
export function buildPipelineTopology(pipeline: PipelineTopologyInput): PipelineTopology {
  const stepsById = new Map<string, PipelineStep>();
  const outgoingEdgesByStepId = new Map<string, PipelineEdge[]>();
  const incomingEdgesByStepId = new Map<string, PipelineEdge[]>();

  for (const step of pipeline.steps) {
    stepsById.set(step.id, step);
  }

  for (const edge of pipeline.edges) {
    addEdge(outgoingEdgesByStepId, edge.fromStepId, edge);
    addEdge(incomingEdgesByStepId, edge.toStepId, edge);
  }

  return {
    stepsById,
    outgoingEdgesByStepId,
    incomingEdgesByStepId,
  };
}

/** Add an edge to one endpoint index without exposing mutable construction details. */
function addEdge(
  edgesByStepId: Map<string, PipelineEdge[]>,
  stepId: string,
  edge: PipelineEdge,
): void {
  const existing = edgesByStepId.get(stepId);

  if (existing) {
    existing.push(edge);
    return;
  }

  edgesByStepId.set(stepId, [edge]);
}
