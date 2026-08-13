/** Canonical cross-service contracts and their public domain boundaries. */
export * as api from "./api/index.js";
export * as common from "./common/index.js";
export * as components from "./components/index.js";
export * as dataset from "./dataset/index.js";
export * as execution from "./execution/index.js";
export * as pipeline from "./pipeline/index.js";

export {
  CONTRACT_VERSION,
  contractVersionSchema,
  versionedContractSchema,
} from "./common/version.js";
export type { ContractVersion, VersionedContract } from "./common/version.js";
