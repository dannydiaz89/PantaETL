import type {
  ComponentMetadata,
  Pipeline,
  PipelineCreateRequest,
  PipelineEdge,
  PipelineStep,
  PipelineUpdateRequest,
} from "@pantaetl/contracts";

import { derivePipelineBuilderGraph } from "./pipeline-builder-graph.js";
import type { PipelineBuilderComponentSelection, PipelineBuilderDraft } from "./pipeline-builder-draft.js";

/** True once the canonical contract can accept the draft: a non-empty name and at least one component. */
export function isPipelineBuilderDraftPersistable(draft: PipelineBuilderDraft): boolean {
  return draft.name.trim().length > 0 && (draft.source !== undefined || draft.transforms.length > 0 || draft.export !== undefined);
}

/** Builds a creation request from a persistable draft; the caller must check `isPipelineBuilderDraftPersistable` first. */
export function createPipelineCreateRequestFromDraft(draft: PipelineBuilderDraft): PipelineCreateRequest {
  const { edges, steps } = derivePipelineBuilderGraph(draft);
  return {
    contractVersion: "v1",
    edges,
    name: draft.name.trim(),
    steps,
    triggers: [{ enabled: false, type: "manual" }],
  };
}

/** Builds a graph-only update request from a draft; omits triggers/state so unrelated pipeline-owned settings are untouched. */
export function createPipelineUpdateRequestFromDraft(draft: PipelineBuilderDraft): PipelineUpdateRequest {
  const { edges, steps } = derivePipelineBuilderGraph(draft);
  return { edges, name: draft.name.trim(), steps };
}

/** Orders a persisted pipeline's steps by following its edges from the step with no incoming edge. */
function orderStepsByEdges(steps: readonly PipelineStep[], edges: readonly PipelineEdge[]): readonly PipelineStep[] {
  if (steps.length === 0) return steps;

  const stepsById = new Map(steps.map((step) => [step.id, step]));
  const nextIdByStepId = new Map(edges.map((edge) => [edge.fromStepId, edge.toStepId]));
  const targetIds = new Set(edges.map((edge) => edge.toStepId));
  const head = steps.find((step) => !targetIds.has(step.id));
  if (head === undefined) return steps;

  const ordered: PipelineStep[] = [];
  let current: PipelineStep | undefined = head;
  while (current !== undefined) {
    ordered.push(current);
    const nextId = nextIdByStepId.get(current.id);
    current = nextId === undefined ? undefined : stepsById.get(nextId);
  }
  return ordered;
}

/**
 * Reconstructs wizard editing state from a persisted pipeline, resolving each step's full
 * metadata through the caller-supplied capability catalog. Returns undefined rather than a
 * partial or fabricated draft when a step's component cannot be resolved (for example, an
 * uninstalled capability) so callers never silently drop or invent configuration.
 */
export function createPipelineBuilderDraftFromPipeline(
  pipeline: Pipeline,
  resolveMetadata: (step: PipelineStep) => ComponentMetadata | undefined,
): PipelineBuilderDraft | undefined {
  const orderedSteps = orderStepsByEdges(pipeline.steps, pipeline.edges);
  const selections: PipelineBuilderComponentSelection[] = [];

  for (const step of orderedSteps) {
    const metadata = resolveMetadata(step);
    if (metadata === undefined) return undefined;

    selections.push({
      id: step.id,
      metadata,
      secretBindings: step.configuration.secretBindings,
      values: step.configuration.values,
    });
  }

  return {
    dirty: false,
    export: selections.find((selection) => selection.metadata.kind === "export"),
    name: pipeline.name,
    source: selections.find((selection) => selection.metadata.kind === "source"),
    transforms: selections.filter((selection) => selection.metadata.kind === "transform"),
  };
}
