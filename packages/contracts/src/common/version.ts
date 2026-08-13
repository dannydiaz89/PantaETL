import { z } from "zod";

/**
 * Current wire version for contracts that carry a version discriminator.
 *
 * Incompatible payload changes require a new version value; consumers must
 * reject versions they do not explicitly support.
 */
export const CONTRACT_VERSION = "v1" as const;

/** Runtime validator for the currently supported contract version. */
export const contractVersionSchema = z.literal(CONTRACT_VERSION);

/** TypeScript representation of a supported contract version. */
export type ContractVersion = z.infer<typeof contractVersionSchema>;

/** Common version envelope embedded by versioned cross-service payloads. */
export const versionedContractSchema = z.object({
  contractVersion: contractVersionSchema,
});

/** TypeScript representation of the common version envelope. */
export type VersionedContract = z.infer<typeof versionedContractSchema>;
