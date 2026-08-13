import { pipelineSchema, type Pipeline } from "@pantaetl/contracts";

import { pipelineComponents, pipelineEdges, pipelines, pipelineTriggers } from "../schema/pipelines.js";

/** Persisted graph records required to build one browser-safe pipeline definition. */
export interface PersistedPipelineGraph {
  /** The owner-scoped pipeline record. */
  readonly pipeline: typeof pipelines.$inferSelect;
  /** Graph nodes belonging to the pipeline. */
  readonly components: readonly (typeof pipelineComponents.$inferSelect)[];
  /** Directed component links belonging to the pipeline. */
  readonly edges: readonly (typeof pipelineEdges.$inferSelect)[];
  /** Manual and schedule triggers belonging to the pipeline. */
  readonly triggers: readonly (typeof pipelineTriggers.$inferSelect)[];
}

/**
 * Maps persisted pipeline records into the canonical, browser-safe Pipeline contract.
 *
 * This boundary deliberately accepts only component configuration and secret binding
 * references. It never reads encrypted secret records or exposes usable credentials.
 */
export function hydratePipeline(graph: PersistedPipelineGraph): Pipeline {
  return pipelineSchema.parse({
    contractVersion: graph.pipeline.contractVersion,
    createdAt: graph.pipeline.createdAt.toISOString(),
    edges: graph.edges.map((edge) => ({
      fromStepId: edge.fromComponentId,
      toStepId: edge.toComponentId,
    })),
    id: graph.pipeline.id,
    name: graph.pipeline.name,
    ownerUserId: graph.pipeline.ownerUserId,
    state: graph.pipeline.state,
    steps: graph.components.map((component) => ({
      componentType: component.componentType,
      componentVersion: component.componentVersion,
      configuration: {
        secretBindings: component.secretBindings,
        values: component.configurationValues,
      },
      id: component.id,
      kind: component.kind,
    })),
    triggers: graph.triggers.map((trigger) => {
      if (trigger.type === "manual") {
        return {
          enabled: trigger.enabled,
          id: trigger.id,
          pipelineId: trigger.pipelineId,
          type: trigger.type,
        };
      }

      return {
        cron: trigger.cron,
        enabled: trigger.enabled,
        id: trigger.id,
        pipelineId: trigger.pipelineId,
        timezone: trigger.timezone,
        type: trigger.type,
      };
    }),
    updatedAt: graph.pipeline.updatedAt.toISOString(),
  }) as Pipeline;
}
