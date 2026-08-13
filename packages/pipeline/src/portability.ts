import type { Pipeline, PipelineState } from "@pantaetl/contracts";

/** A component implementation available in the deployment receiving an import. */
export interface AvailablePipelineCapability {
  /** Stable component type identifier. */
  readonly type: string;
  /** Supported component contract version. */
  readonly version: string;
}

/**
 * A portable, identity-free pipeline snapshot.
 *
 * Triggers are excluded because schedules belong to the destination pipeline.
 * Secret bindings are cleared so a target deployment must deliberately rebind
 * credentials before enabling the pipeline.
 */
export interface PortablePipelineDefinition {
  /** Contract version for the copied pipeline graph. */
  readonly contractVersion: Pipeline["contractVersion"];
  /** Human-readable pipeline name. */
  readonly name: string;
  /** Component graph nodes with non-secret configuration values only. */
  readonly steps: Pipeline["steps"];
  /** Directed links between the portable step identifiers. */
  readonly edges: Pipeline["edges"];
}

/** A portable definition accepted by a target deployment but not yet enabled. */
export interface ImportedPipelineDefinition extends PortablePipelineDefinition {
  /** Imports must be reviewed before they can run. */
  readonly state: Extract<PipelineState, "draft" | "disabled">;
}

/** Error raised when a portable definition references a component absent from the target deployment. */
export class UnavailablePipelineCapabilityError extends Error {
  /** Explain which required component capability is unavailable. */
  constructor(message: string) {
    super(message);
    this.name = "UnavailablePipelineCapabilityError";
  }
}

/**
 * Produce a standalone pipeline definition without deployment identity, triggers, or secret bindings.
 *
 * Pipeline contract validation ensures copied configuration values already
 * exclude usable credentials. Clearing bindings still requires every duplicate
 * or import to deliberately re-enter or rebind its credentials.
 */
export function exportPortablePipelineDefinition(pipeline: Pipeline): PortablePipelineDefinition {
  return {
    contractVersion: pipeline.contractVersion,
    name: pipeline.name,
    steps: copyPortableSteps(pipeline.steps),
    edges: pipeline.edges.map((edge) => ({ ...edge })),
  };
}

/** Create a draft duplicate with copied non-secret configuration and no credential bindings. */
export function duplicatePipelineDefinition(
  pipeline: Pipeline,
  name: string,
): ImportedPipelineDefinition {
  return {
    ...exportPortablePipelineDefinition(pipeline),
    name,
    state: "draft",
  };
}

/**
 * Accept a portable definition only when every required component capability exists locally.
 *
 * The returned definition remains draft even when the source pipeline was
 * enabled, preventing imported work from running before review and rebinding.
 */
export function importPortablePipelineDefinition(
  definition: PortablePipelineDefinition,
  availableCapabilities: Iterable<AvailablePipelineCapability>,
): ImportedPipelineDefinition {
  const availableKeys = new Set(
    [...availableCapabilities].map((capability) => capabilityKey(capability.type, capability.version)),
  );

  for (const step of definition.steps) {
    if (!availableKeys.has(capabilityKey(step.componentType, step.componentVersion))) {
      throw new UnavailablePipelineCapabilityError(
        `Required component ${step.componentType}@${step.componentVersion} is unavailable.`,
      );
    }
  }

  return {
    ...definition,
    steps: copyPortableSteps(definition.steps),
    edges: definition.edges.map((edge) => ({ ...edge })),
    state: "draft",
  };
}

/** Copy only non-secret configuration and make the snapshot independent from its source object. */
function copyPortableSteps(steps: Pipeline["steps"]): Pipeline["steps"] {
  const [firstStep, ...remainingSteps] = steps;

  return [copyPortableStep(firstStep), ...remainingSteps.map(copyPortableStep)];
}

/** Copy one graph node while intentionally discarding its credential binding references. */
function copyPortableStep(step: Pipeline["steps"][number]): Pipeline["steps"][number] {
  return {
    ...step,
    configuration: {
      values: copyPortableValues(step.configuration.values),
      secretBindings: [],
    },
  };
}

/** Copy JSON-safe contract values so exported configuration cannot mutate its source pipeline. */
function copyPortableValues<Value>(values: Value): Value {
  return JSON.parse(JSON.stringify(values)) as Value;
}

/** Build an unambiguous component type-and-version lookup key. */
function capabilityKey(type: string, version: string): string {
  return `${type}@${version}`;
}
