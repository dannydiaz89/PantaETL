import type { CommonPrimitives } from "../generated/common.js";
import { canonicalSchemas, propertySchema, zodFromJsonSchema } from "../json-schema.js";

/** Runtime validator for ISO 8601 timestamps with an explicit offset. */
export const timestampSchema = zodFromJsonSchema(
  propertySchema(canonicalSchemas.common, "timestamp"),
);
export type Timestamp = CommonPrimitives["timestamp"];

/** Runtime validator for major wire-version identifiers such as `v1`. */
export const versionSchema = zodFromJsonSchema(
  propertySchema(canonicalSchemas.common, "version"),
);
export type Version = CommonPrimitives["version"];

/** Broad dataset families shared by component input/output metadata. */
export const dataFamilySchema = zodFromJsonSchema(
  propertySchema(canonicalSchemas.common, "dataFamily"),
);
export type DataFamily = CommonPrimitives["dataFamily"];
