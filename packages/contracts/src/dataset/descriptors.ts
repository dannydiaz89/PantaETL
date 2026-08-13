import type { ArtifactDescriptor } from "../generated/artifact-descriptor.js";
import type { DatasetDescriptor } from "../generated/dataset-descriptor.js";
import {
  canonicalSchemas,
  propertySchema,
  zodFromJsonSchema,
} from "../json-schema.js";

const artifactRetention = propertySchema(canonicalSchemas.artifactDescriptor, "retention");
const datasetStorage = propertySchema(canonicalSchemas.datasetDescriptor, "storage");
const retentionDays = propertySchema(artifactRetention, "retentionDays") as {
  default?: unknown;
};

/** Runtime validator derived from the canonical Dataset descriptor JSON Schema. */
export const datasetDescriptorSchema = zodFromJsonSchema(canonicalSchemas.datasetDescriptor);
export type { DatasetDescriptor } from "../generated/dataset-descriptor.js";

/** Runtime validator derived from the canonical Artifact descriptor JSON Schema. */
export const artifactDescriptorSchema = zodFromJsonSchema(canonicalSchemas.artifactDescriptor);
export type { ArtifactDescriptor } from "../generated/artifact-descriptor.js";

/** Runtime validator for optional Dataset structure metadata. */
export const dataStructureSchema = zodFromJsonSchema(
  propertySchema(canonicalSchemas.datasetDescriptor, "structure"),
);
export type DataStructure = NonNullable<DatasetDescriptor["structure"]>;

/** Runtime validator for credential-free storage metadata. */
export const storageDescriptorSchema = zodFromJsonSchema(datasetStorage);
export type StorageDescriptor = DatasetDescriptor["storage"];

/** Runtime validator for internal storage backend choices. */
export const storageKindSchema = zodFromJsonSchema(propertySchema(datasetStorage, "kind"));
export type StorageKind = StorageDescriptor["kind"];

/** Runtime validator for retained artifact expiry metadata. */
export const artifactRetentionSchema = zodFromJsonSchema(artifactRetention);
export type ArtifactRetention = ArtifactDescriptor["retention"];

/** Default artifact retention encoded by the canonical schema. */
export const DEFAULT_ARTIFACT_RETENTION_DAYS =
  typeof retentionDays.default === "number" ? retentionDays.default : 30;
