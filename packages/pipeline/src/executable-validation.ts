import type { ComponentMetadata, PipelineEdge, PipelineStep } from "@pantaetl/contracts";

import { checkComponentCompatibility } from "./compatibility.js";
import { buildPipelineTopology, type PipelineTopology, type PipelineTopologyInput } from "./topology.js";

/** One reason a pipeline graph is not yet safe to enable and run. */
export type PipelineExecutableViolation =
  | { readonly kind: "missing-source" }
  | { readonly kind: "multiple-sources"; readonly stepIds: readonly string[] }
  | { readonly kind: "missing-export" }
  | { readonly kind: "multiple-exports"; readonly stepIds: readonly string[] }
  | { readonly kind: "branching-step"; readonly stepId: string }
  | { readonly kind: "disconnected-step"; readonly stepId: string }
  | {
      readonly kind: "unavailable-component";
      readonly stepId: string;
      readonly componentType: string;
      readonly componentVersion: string;
    }
  | { readonly kind: "missing-config-value"; readonly stepId: string; readonly configKey: string }
  | { readonly kind: "missing-secret-binding"; readonly stepId: string; readonly configKey: string }
  | {
      readonly kind: "incompatible-adjacent-steps";
      readonly upstreamStepId: string;
      readonly downstreamStepId: string;
      readonly reason: string;
    };

/** Outcome of checking whether a pipeline graph qualifies as a complete, runnable chain. */
export type PipelineExecutableResult =
  | { readonly executable: true }
  | { readonly executable: false; readonly violations: readonly PipelineExecutableViolation[] };

/** Error raised when an operation requires a pipeline that has failed executable validation. */
export class PipelineNotExecutableError extends Error {
  /** Every reason execution was refused, for callers that need to explain all of them at once. */
  readonly violations: readonly PipelineExecutableViolation[];

  constructor(violations: readonly PipelineExecutableViolation[]) {
    super(`Pipeline is not executable: ${violations.map(describeViolation).join("; ")}.`);
    this.name = "PipelineNotExecutableError";
    this.violations = violations;
  }
}

/**
 * Check whether a pipeline graph is a complete, connected Source-to-Export chain
 * that can safely be enabled and run, given the component capabilities currently
 * installed in the deployment.
 *
 * This is a second, independent validation pass from contract/persistence
 * validation, which deliberately permits an incomplete draft. Callers run this
 * check only when deciding whether a pipeline may transition to enabled, never
 * during ordinary save.
 */
export function checkPipelineExecutable(
  pipeline: PipelineTopologyInput,
  availableComponents: readonly ComponentMetadata[],
): PipelineExecutableResult {
  const violations: PipelineExecutableViolation[] = [];
  const topology = buildPipelineTopology(pipeline);
  const componentsByKey = indexComponentsByKey(availableComponents);
  const metadataByStepId = new Map<string, ComponentMetadata>();

  const sourceSteps = pipeline.steps.filter((step) => step.kind === "source");
  const exportSteps = pipeline.steps.filter((step) => step.kind === "export");

  if (sourceSteps.length === 0) {
    violations.push({ kind: "missing-source" });
  } else if (sourceSteps.length > 1) {
    violations.push({ kind: "multiple-sources", stepIds: sourceSteps.map((step) => step.id) });
  }

  if (exportSteps.length === 0) {
    violations.push({ kind: "missing-export" });
  } else if (exportSteps.length > 1) {
    violations.push({ kind: "multiple-exports", stepIds: exportSteps.map((step) => step.id) });
  }

  for (const step of pipeline.steps) {
    const outgoingCount = topology.outgoingEdgesByStepId.get(step.id)?.length ?? 0;
    const incomingCount = topology.incomingEdgesByStepId.get(step.id)?.length ?? 0;

    if (outgoingCount > 1 || incomingCount > 1) {
      violations.push({ kind: "branching-step", stepId: step.id });
    }

    const metadata = componentsByKey.get(componentKey(step.componentType, step.componentVersion));

    if (!metadata) {
      violations.push({
        kind: "unavailable-component",
        stepId: step.id,
        componentType: step.componentType,
        componentVersion: step.componentVersion,
      });
      continue;
    }

    metadataByStepId.set(step.id, metadata);
    violations.push(...checkStepConfiguration(step, metadata));
  }

  const [sourceStep] = sourceSteps;

  if (sourceStep && exportSteps.length === 1) {
    violations.push(...checkChainConnectivity(pipeline, topology, sourceStep.id, metadataByStepId));
  }

  return violations.length === 0 ? { executable: true } : { executable: false, violations };
}

/** Throw with every violation when a pipeline is not yet safe to enable and run. */
export function assertPipelineExecutable(
  pipeline: PipelineTopologyInput,
  availableComponents: readonly ComponentMetadata[],
): void {
  const result = checkPipelineExecutable(pipeline, availableComponents);

  if (!result.executable) {
    throw new PipelineNotExecutableError(result.violations);
  }
}

/** Confirm every step is reached by one linear walk from the Source and adjacent steps are compatible. */
function checkChainConnectivity(
  pipeline: PipelineTopologyInput,
  topology: PipelineTopology,
  sourceStepId: string,
  metadataByStepId: ReadonlyMap<string, ComponentMetadata>,
): PipelineExecutableViolation[] {
  const violations: PipelineExecutableViolation[] = [];
  const chainStepIds = walkLinearChain(topology, sourceStepId);
  const reachedStepIds = new Set(chainStepIds);

  for (const step of pipeline.steps) {
    if (!reachedStepIds.has(step.id)) {
      violations.push({ kind: "disconnected-step", stepId: step.id });
    }
  }

  for (let index = 0; index < chainStepIds.length - 1; index += 1) {
    const upstreamStepId = chainStepIds[index];
    const downstreamStepId = chainStepIds[index + 1];

    if (upstreamStepId === undefined || downstreamStepId === undefined) {
      continue;
    }

    const upstreamMetadata = metadataByStepId.get(upstreamStepId);
    const downstreamMetadata = metadataByStepId.get(downstreamStepId);

    if (!upstreamMetadata || !downstreamMetadata) {
      continue;
    }

    const result = checkComponentCompatibility(upstreamMetadata, downstreamMetadata);

    if (!result.compatible) {
      violations.push({
        kind: "incompatible-adjacent-steps",
        upstreamStepId,
        downstreamStepId,
        reason: result.reason ?? "Adjacent components are incompatible.",
      });
    }
  }

  return violations;
}

/** Follow single, unambiguous outgoing edges from a starting step until a branch, dead end, or cycle. */
function walkLinearChain(topology: PipelineTopology, startStepId: string): string[] {
  const chainStepIds: string[] = [];
  const visitedStepIds = new Set<string>();
  let currentStepId: string | undefined = startStepId;

  while (currentStepId !== undefined && !visitedStepIds.has(currentStepId)) {
    visitedStepIds.add(currentStepId);
    chainStepIds.push(currentStepId);

    const outgoing: readonly PipelineEdge[] = topology.outgoingEdgesByStepId.get(currentStepId) ?? [];
    const [onlyOutgoingEdge] = outgoing;
    currentStepId = outgoing.length === 1 && onlyOutgoingEdge ? onlyOutgoingEdge.toStepId : undefined;
  }

  return chainStepIds;
}

/** Check one step's declared configuration against its resolved component's required fields. */
function checkStepConfiguration(
  step: PipelineStep,
  metadata: ComponentMetadata,
): PipelineExecutableViolation[] {
  const violations: PipelineExecutableViolation[] = [];
  const boundSecretKeys = new Set(step.configuration.secretBindings.map((binding) => binding.key));

  for (const field of metadata.configFields) {
    if (!field.required) {
      continue;
    }

    if (field.secret) {
      if (!boundSecretKeys.has(field.key)) {
        violations.push({ kind: "missing-secret-binding", stepId: step.id, configKey: field.key });
      }
      continue;
    }

    if (!hasConfigValue(step.configuration.values, field.key)) {
      violations.push({ kind: "missing-config-value", stepId: step.id, configKey: field.key });
    }
  }

  return violations;
}

/** Treat undefined, null, and empty-string values as absent regardless of the field's declared type. */
function hasConfigValue(values: PipelineStep["configuration"]["values"], key: string): boolean {
  const value = values[key];
  return value !== undefined && value !== null && value !== "";
}

/** Build the lookup key used to resolve a step's declared component in the available catalog. */
function componentKey(type: string, version: string): string {
  return `${type}@${version}`;
}

/** Index available components by type-and-version for constant-time per-step availability lookups. */
function indexComponentsByKey(
  components: readonly ComponentMetadata[],
): ReadonlyMap<string, ComponentMetadata> {
  return new Map(
    components.map((component) => [componentKey(component.type, component.version), component]),
  );
}

/** Render one violation as a short, safe internal description for error messages and logs. */
function describeViolation(violation: PipelineExecutableViolation): string {
  switch (violation.kind) {
    case "missing-source":
      return "no Source step";
    case "multiple-sources":
      return `multiple Source steps (${violation.stepIds.join(", ")})`;
    case "missing-export":
      return "no Export step";
    case "multiple-exports":
      return `multiple Export steps (${violation.stepIds.join(", ")})`;
    case "branching-step":
      return `step ${violation.stepId} branches instead of forming a linear chain`;
    case "disconnected-step":
      return `step ${violation.stepId} is not connected to the Source-to-Export chain`;
    case "unavailable-component":
      return `step ${violation.stepId} uses unavailable component ${violation.componentType}@${violation.componentVersion}`;
    case "missing-config-value":
      return `step ${violation.stepId} is missing required configuration value ${violation.configKey}`;
    case "missing-secret-binding":
      return `step ${violation.stepId} is missing required secret binding ${violation.configKey}`;
    case "incompatible-adjacent-steps":
      return `${violation.upstreamStepId} -> ${violation.downstreamStepId}: ${violation.reason}`;
  }
}
