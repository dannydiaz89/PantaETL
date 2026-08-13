/** Public boundary for Dataset and Artifact contracts. */
export {
  artifactDescriptorSchema,
  artifactRetentionSchema,
  dataStructureSchema,
  datasetDescriptorSchema,
  DEFAULT_ARTIFACT_RETENTION_DAYS,
  storageDescriptorSchema,
  storageKindSchema,
} from "./descriptors.js";
export type {
  ArtifactDescriptor,
  ArtifactRetention,
  DataStructure,
  DatasetDescriptor,
  StorageDescriptor,
  StorageKind,
} from "./descriptors.js";
