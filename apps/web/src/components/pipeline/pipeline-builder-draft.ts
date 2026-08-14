import type { ComponentConfiguration, ComponentMetadata, SecretBinding } from "@pantaetl/contracts";

type ConfigurationValues = ComponentConfiguration["values"];

/**
 * A component chosen and configured within an in-progress pipeline draft.
 * `id` is the stable local identity of the slot it occupies (the Source, the
 * Export, or one Transform position); it is preserved across reselecting a
 * different component for the same slot and across Transform reordering.
 */
export interface PipelineBuilderComponentSelection {
  readonly id: string;
  readonly metadata: ComponentMetadata;
  readonly secretBindings: readonly SecretBinding[];
  readonly values: ConfigurationValues;
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
  readonly transforms: readonly PipelineBuilderComponentSelection[];
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

/**
 * Computes the next selection for a single-component slot (the Source or the Export).
 * Reselecting the same component type/version keeps its configuration; choosing a
 * different component keeps the slot's draft-local id but clears configuration that
 * belonged to the previous component's fields.
 */
export function nextPipelineBuilderComponentSelection(
  current: PipelineBuilderComponentSelection | undefined,
  metadata: ComponentMetadata,
  createId: () => string = () => globalThis.crypto.randomUUID(),
): PipelineBuilderComponentSelection {
  if (current !== undefined && current.metadata.type === metadata.type && current.metadata.version === metadata.version) {
    return { ...current, metadata };
  }

  return { id: current?.id ?? createId(), metadata, secretBindings: [], values: {} };
}

/** Replaces the Source selection, preserving its draft-local id and clearing stale configuration on a component change. */
export function setPipelineBuilderSource(
  draft: PipelineBuilderDraft,
  metadata: ComponentMetadata,
  createId?: () => string,
): PipelineBuilderDraft {
  return updatePipelineBuilderDraft(draft, { source: nextPipelineBuilderComponentSelection(draft.source, metadata, createId) });
}

/** Replaces the non-secret configuration values of the current Source selection; a no-op without a selected Source. */
export function setPipelineBuilderSourceValues(draft: PipelineBuilderDraft, values: ConfigurationValues): PipelineBuilderDraft {
  if (draft.source === undefined) return draft;
  return updatePipelineBuilderDraft(draft, { source: { ...draft.source, values } });
}
