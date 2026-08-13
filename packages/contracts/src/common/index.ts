/** Shared primitives used by every cross-service contract domain. */
export {
  CONTRACT_VERSION,
  contractVersionSchema,
  versionedContractSchema,
} from "./version.js";
export type { ContractVersion, VersionedContract } from "./version.js";
