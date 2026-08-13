import type { ComponentMetadata, DataFamily } from "@pantaetl/contracts";

/** Result of checking whether one component can provide data to another. */
export interface ComponentCompatibilityResult {
  /** Whether at least one declared output family can flow to a declared input family. */
  readonly compatible: boolean;
  /** Families that establish compatibility, empty when the connection is invalid. */
  readonly compatibleFamilies: readonly DataFamily[];
  /** Safe explanation suitable for validation errors and user interfaces. */
  readonly reason: string | undefined;
}

/** Error raised when a pipeline connection cannot exchange a supported dataset family. */
export class IncompatiblePipelineComponentsError extends Error {
  /** Explain the component-boundary rule that rejected the connection. */
  constructor(message: string) {
    super(message);
    this.name = "IncompatiblePipelineComponentsError";
  }
}

/**
 * Check whether the upstream component can provide a supported dataset to the downstream component.
 *
 * Sources begin the data chain and cannot consume input. Exports end the chain
 * and cannot produce output. Transformations express any conversion only by
 * declaring their input and output families independently.
 */
export function checkComponentCompatibility(
  upstream: ComponentMetadata,
  downstream: ComponentMetadata,
): ComponentCompatibilityResult {
  if (upstream.kind === "export") {
    return incompatible("An Export cannot provide data to another component.");
  }

  if (downstream.kind === "source") {
    return incompatible("A Source cannot consume data from another component.");
  }

  const compatibleFamilies = supportedFamilies(upstream.outputFamilies, downstream.inputFamilies);

  if (compatibleFamilies.length === 0) {
    return incompatible(
      `Component ${upstream.type} cannot provide a dataset accepted by ${downstream.type}.`,
    );
  }

  return { compatible: true, compatibleFamilies, reason: undefined };
}

/** Throw when a component connection is known to be incompatible before execution starts. */
export function assertComponentsCompatible(
  upstream: ComponentMetadata,
  downstream: ComponentMetadata,
): void {
  const result = checkComponentCompatibility(upstream, downstream);

  if (!result.compatible) {
    throw new IncompatiblePipelineComponentsError(
      result.reason ?? "Pipeline components are incompatible.",
    );
  }
}

/** Return families that can cross a component boundary according to their metadata declarations. */
function supportedFamilies(
  outputFamilies: readonly DataFamily[],
  inputFamilies: readonly DataFamily[],
): DataFamily[] {
  const compatibleFamilies = new Set<DataFamily>();

  for (const outputFamily of outputFamilies) {
    for (const inputFamily of inputFamilies) {
      if (familiesAreCompatible(outputFamily, inputFamily)) {
        compatibleFamilies.add(outputFamily === "any" ? inputFamily : outputFamily);
      }
    }
  }

  return [...compatibleFamilies];
}

/** Treat `any` as the broad family; otherwise require an exact structural family match. */
function familiesAreCompatible(outputFamily: DataFamily, inputFamily: DataFamily): boolean {
  return outputFamily === "any" || inputFamily === "any" || outputFamily === inputFamily;
}

/** Build a consistently shaped failed compatibility result. */
function incompatible(reason: string): ComponentCompatibilityResult {
  return { compatible: false, compatibleFamilies: [], reason };
}
