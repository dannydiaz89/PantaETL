import type { PipelineCreateRequest } from "@pantaetl/contracts";

/** Non-secret values collected to create a valid starter pipeline graph. */
export interface PipelineDraftValues {
  readonly artifactFileName: string;
  readonly inputFilePath: string;
  readonly name: string;
}

/** Creates a complete Source-to-Export draft without placing usable secrets in browser state. */
export function createPipelineDraft(
  values: PipelineDraftValues,
  createId: () => string = () => globalThis.crypto.randomUUID(),
): PipelineCreateRequest {
  const sourceId = createId();
  const exportId = createId();

  return {
    contractVersion: "v1",
    edges: [{ fromStepId: sourceId, toStepId: exportId }],
    name: values.name.trim(),
    steps: [
      {
        componentType: "source.csv",
        componentVersion: "v1",
        configuration: { secretBindings: [], values: { path: values.inputFilePath.trim() } },
        id: sourceId,
        kind: "source",
      },
      {
        componentType: "export.csv",
        componentVersion: "v1",
        configuration: { secretBindings: [], values: { fileName: values.artifactFileName.trim() } },
        id: exportId,
        kind: "export",
      },
    ],
    triggers: [{ enabled: false, type: "manual" }],
  };
}
