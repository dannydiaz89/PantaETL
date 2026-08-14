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

/** Replaces the Export selection, preserving its draft-local id and clearing stale configuration on a component change. */
export function setPipelineBuilderExport(
  draft: PipelineBuilderDraft,
  metadata: ComponentMetadata,
  createId?: () => string,
): PipelineBuilderDraft {
  return updatePipelineBuilderDraft(draft, { export: nextPipelineBuilderComponentSelection(draft.export, metadata, createId) });
}

/** Replaces the non-secret configuration values of the current Export selection; a no-op without a selected Export. */
export function setPipelineBuilderExportValues(draft: PipelineBuilderDraft, values: ConfigurationValues): PipelineBuilderDraft {
  if (draft.export === undefined) return draft;
  return updatePipelineBuilderDraft(draft, { export: { ...draft.export, values } });
}

/** True once a Source and an Export are both selected; Transforms remain optional. */
export function isPipelineBuilderDraftComplete(draft: PipelineBuilderDraft): boolean {
  return draft.source !== undefined && draft.export !== undefined;
}

/** Clears the dirty flag after a successful save without otherwise changing the draft. */
export function markPipelineBuilderDraftSaved(draft: PipelineBuilderDraft): PipelineBuilderDraft {
  return { ...draft, dirty: false };
}

/** Appends a new Transform after the existing ones with a fresh draft-local id and empty configuration. */
export function addPipelineBuilderTransform(
  draft: PipelineBuilderDraft,
  metadata: ComponentMetadata,
  createId: () => string = () => globalThis.crypto.randomUUID(),
): PipelineBuilderDraft {
  const transform: PipelineBuilderComponentSelection = { id: createId(), metadata, secretBindings: [], values: {} };
  return updatePipelineBuilderDraft(draft, { transforms: [...draft.transforms, transform] });
}

/** Replaces the non-secret configuration values of one existing Transform slot; a no-op if the id is not present. */
export function setPipelineBuilderTransformValues(draft: PipelineBuilderDraft, id: string, values: ConfigurationValues): PipelineBuilderDraft {
  return updatePipelineBuilderDraft(draft, {
    transforms: draft.transforms.map((transform) => (transform.id === id ? { ...transform, values } : transform)),
  });
}

/** Removes one Transform slot; the remaining Transforms keep their existing ids and relative order. */
export function removePipelineBuilderTransform(draft: PipelineBuilderDraft, id: string): PipelineBuilderDraft {
  return updatePipelineBuilderDraft(draft, { transforms: draft.transforms.filter((transform) => transform.id !== id) });
}

/** Swaps one Transform with its neighbor in the given direction; a no-op at either end of the list or for an unknown id. */
export function movePipelineBuilderTransform(
  draft: PipelineBuilderDraft,
  id: string,
  direction: "up" | "down",
): PipelineBuilderDraft {
  const index = draft.transforms.findIndex((transform) => transform.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || targetIndex < 0 || targetIndex >= draft.transforms.length) return draft;

  const moved = draft.transforms[index];
  const displaced = draft.transforms[targetIndex];
  if (moved === undefined || displaced === undefined) return draft;

  const transforms = draft.transforms.map((transform, position) => {
    if (position === index) return displaced;
    if (position === targetIndex) return moved;
    return transform;
  });

  return updatePipelineBuilderDraft(draft, { transforms });
}
