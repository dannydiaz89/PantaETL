import type { ComponentConfiguration, ComponentMetadata, SecretBinding } from "@pantaetl/contracts";

type ConfigurationValues = ComponentConfiguration["values"];

/** A component chosen and configured within an in-progress pipeline draft. */
export interface PipelineBuilderComponentSelection {
  readonly metadata: ComponentMetadata;
  readonly secretBindings: readonly SecretBinding[];
  readonly values: ConfigurationValues;
}

/** A Transform selection with a stable local identity preserved across reordering. */
export interface PipelineBuilderTransformSelection extends PipelineBuilderComponentSelection {
  readonly id: string;
}

/** Fixed, ordered identifiers for the three pipeline creation wizard stages. */
export const PIPELINE_BUILDER_STEPS = ["source", "transforms", "export"] as const;

/** One stage of the three-step pipeline creation wizard. */
export type PipelineBuilderStep = (typeof PIPELINE_BUILDER_STEPS)[number];

/**
 * Browser-only editing state for a pipeline being created or edited in the wizard.
 * This is not a persistence or domain model; it is converted to canonical Pipeline
 * steps/edges only when the draft is saved.
 */
export interface PipelineBuilderDraft {
  readonly dirty: boolean;
  readonly export: PipelineBuilderComponentSelection | undefined;
  readonly name: string;
  readonly source: PipelineBuilderComponentSelection | undefined;
  readonly transforms: readonly PipelineBuilderTransformSelection[];
}

/** Creates an empty draft positioned at the first wizard stage. */
export function createEmptyPipelineBuilderDraft(): PipelineBuilderDraft {
  return { dirty: false, export: undefined, name: "", source: undefined, transforms: [] };
}

/** Applies a partial change to a draft and marks it dirty; the input draft is left unchanged. */
export function updatePipelineBuilderDraft(
  draft: PipelineBuilderDraft,
  changes: Partial<Omit<PipelineBuilderDraft, "dirty">>,
): PipelineBuilderDraft {
  return { ...draft, ...changes, dirty: true };
}

/** Returns the wizard step immediately after the supplied step, or undefined at the last step. */
export function nextPipelineBuilderStep(step: PipelineBuilderStep): PipelineBuilderStep | undefined {
  return PIPELINE_BUILDER_STEPS[PIPELINE_BUILDER_STEPS.indexOf(step) + 1];
}

/** Returns the wizard step immediately before the supplied step, or undefined at the first step. */
export function previousPipelineBuilderStep(step: PipelineBuilderStep): PipelineBuilderStep | undefined {
  const index = PIPELINE_BUILDER_STEPS.indexOf(step);
  return index <= 0 ? undefined : PIPELINE_BUILDER_STEPS[index - 1];
}
