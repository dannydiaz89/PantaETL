/** Pure pipeline-domain utilities independent of persistence and user interfaces. */
export { buildPipelineTopology } from "./topology.js";
export type { PipelineTopology, PipelineTopologyInput } from "./topology.js";
export {
  assertComponentsCompatible,
  checkComponentCompatibility,
  IncompatiblePipelineComponentsError,
} from "./compatibility.js";
export type { ComponentCompatibilityResult } from "./compatibility.js";
export {
  duplicatePipelineDefinition,
  exportPortablePipelineDefinition,
  importPortablePipelineDefinition,
  UnavailablePipelineCapabilityError,
} from "./portability.js";
export type {
  AvailablePipelineCapability,
  ImportedPipelineDefinition,
  MissingPipelineCapability,
  PortablePipelineDefinition,
  RequiredPipelineCapability,
} from "./portability.js";
export {
  assertPipelineExecutable,
  checkPipelineExecutable,
  PipelineNotExecutableError,
} from "./executable-validation.js";
export type {
  PipelineExecutableResult,
  PipelineExecutableViolation,
} from "./executable-validation.js";
export {
  completeActiveRun,
  createPipelineExecutionState,
  enqueuePipelineRun,
  isPipelineEditable,
  PipelineStateTransitionError,
  requestActiveRunCancellation,
  setPipelineState,
  startActiveRun,
} from "./state-machine.js";
export type {
  ActivePipelineRun,
  PipelineExecutionState,
  PipelineTerminalRunState,
} from "./state-machine.js";
