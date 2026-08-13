import { z } from "zod";

import type { CommonPrimitives } from "../generated/common.js";
import { canonicalSchemas, propertySchema, zodFromJsonSchema } from "../json-schema.js";

/**
 * Current wire version for contracts that carry a version discriminator.
 *
 * Incompatible payload changes require a new version value; consumers must
 * reject versions they do not explicitly support.
 */
export const contractVersionSchema = zodFromJsonSchema(
  propertySchema(canonicalSchemas.common, "contractVersion"),
);

export const CONTRACT_VERSION = contractVersionSchema.parse(
  (propertySchema(canonicalSchemas.common, "contractVersion") as { const: unknown }).const,
) as CommonPrimitives["contractVersion"];

/** Runtime validator for the currently supported contract version. */
export type ContractVersion = CommonPrimitives["contractVersion"];

/** Common version envelope embedded by versioned cross-service payloads. */
export const versionedContractSchema = z.object({
  contractVersion: contractVersionSchema as z.ZodType<ContractVersion>,
});

/** TypeScript representation of the common version envelope. */
export type VersionedContract = { contractVersion: ContractVersion };
