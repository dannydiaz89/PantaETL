import { describe, expect, it } from "vitest";

import { buildPipelineTopology, type PipelineTopologyInput } from "../src/index.js";

const ids = {
  export: "123e4567-e89b-12d3-a456-426614174020",
  source: "123e4567-e89b-12d3-a456-426614174021",
};

const pipeline: PipelineTopologyInput = {
  steps: [
    {
      id: ids.source,
      kind: "source",
      componentType: "source.csv",
      componentVersion: "v1",
      configuration: { values: {}, secretBindings: [] },
    },
    {
      id: ids.export,
      kind: "export",
      componentType: "export.csv",
      componentVersion: "v1",
      configuration: { values: {}, secretBindings: [] },
    },
  ],
  edges: [{ fromStepId: ids.source, toStepId: ids.export }],
};

describe("pipeline topology", () => {
  it("indexes steps and their incoming and outgoing edges", () => {
    const topology = buildPipelineTopology(pipeline);

    expect(topology.stepsById.get(ids.source)?.kind).toBe("source");
    expect(topology.outgoingEdgesByStepId.get(ids.source)).toEqual(pipeline.edges);
    expect(topology.incomingEdgesByStepId.get(ids.export)).toEqual(pipeline.edges);
    expect(topology.incomingEdgesByStepId.get(ids.source)).toBeUndefined();
    expect(topology.outgoingEdgesByStepId.get(ids.export)).toBeUndefined();
  });
});
