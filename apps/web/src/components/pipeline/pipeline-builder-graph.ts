import type { PipelineEdge, PipelineStep } from "@pantaetl/contracts";

import type { PipelineBuilderComponentSelection, PipelineBuilderDraft } from "./pipeline-builder-draft.js";

/** Converts one draft slot into its canonical step, carrying the slot's draft-local id forward as the step id. */
export function pipelineStepFromSelection(selection: PipelineBuilderComponentSelection): PipelineStep {
  return {
    id: selection.id,
    kind: selection.metadata.kind,
    componentType: selection.metadata.type,
    componentVersion: selection.metadata.version,
    configuration: { values: selection.values, secretBindings: [...selection.secretBindings] },
  };
}

/** Orders the draft's populated slots as Source, then Transforms in display order, then Export, skipping unset slots. */
export function derivePipelineBuilderSteps(draft: PipelineBuilderDraft): PipelineStep[] {
  const selections = [draft.source, ...draft.transforms, draft.export].filter(
    (selection): selection is PipelineBuilderComponentSelection => selection !== undefined,
  );

  return selections.map(pipelineStepFromSelection);
}

/** Connects each step to the one immediately after it, so wizard order is the sole determinant of graph shape. */
export function derivePipelineBuilderEdges(steps: readonly PipelineStep[]): PipelineEdge[] {
  return steps.slice(1).map((step, index) => ({ fromStepId: steps[index].id, toStepId: step.id }));
}

/** Derives the canonical steps and adjacent edges for a draft in one call. */
export function derivePipelineBuilderGraph(draft: PipelineBuilderDraft): { steps: PipelineStep[]; edges: PipelineEdge[] } {
  const steps = derivePipelineBuilderSteps(draft);
  return { steps, edges: derivePipelineBuilderEdges(steps) };
}
