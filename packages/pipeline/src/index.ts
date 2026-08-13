/** Pure pipeline-domain utilities independent of persistence and user interfaces. */
export { buildPipelineTopology } from "./topology.js";
export type { PipelineTopology, PipelineTopologyInput } from "./topology.js";
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
