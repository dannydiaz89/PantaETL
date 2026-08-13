import { z } from "zod";

import {
  artifactIdSchema,
  datasetIdSchema,
  identifierSchema,
  pipelineIdSchema,
  runIdSchema,
} from "../common/identifiers.js";
import { dataFamilySchema, timestampSchema } from "../common/primitives.js";
import { versionedContractSchema } from "../common/version.js";

/** Supported internal storage backends for datasets and retained artifacts. */
export const storageKindSchema = z.enum(["local", "s3"]);
export type StorageKind = z.infer<typeof storageKindSchema>;

/** Location metadata that identifies stored data without containing credentials. */
export const storageDescriptorSchema = z.object({
  kind: storageKindSchema,
  location: z.string().min(1),
  encrypted: z.boolean(),
});
export type StorageDescriptor = z.infer<typeof storageDescriptorSchema>;

/** Optional structural metadata inferred or declared for a Dataset. */
export const dataStructureSchema = z.object({
  format: z.string().min(1),
  fields: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.string().min(1),
        nullable: z.boolean().optional(),
      }),
    )
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type DataStructure = z.infer<typeof dataStructureSchema>;

/**
 * Descriptor for temporary execution data.
 *
 * Datasets are owned by a run and have an explicit expiry so terminal cleanup
 * does not need to infer deletion safety from storage paths.
 */
export const datasetDescriptorSchema = versionedContractSchema.extend({
  id: datasetIdSchema,
  family: dataFamilySchema,
  format: z.string().min(1),
  storage: storageDescriptorSchema,
  structure: dataStructureSchema.optional(),
  pipelineId: pipelineIdSchema,
  runId: runIdSchema,
  stepId: identifierSchema,
  createdAt: timestampSchema,
  expiresAt: timestampSchema,
});
export type DatasetDescriptor = z.infer<typeof datasetDescriptorSchema>;

/** Default retention for file artifacts when no policy overrides it. */
export const DEFAULT_ARTIFACT_RETENTION_DAYS = 30;

/** Retention metadata retained independently from run history. */
export const artifactRetentionSchema = z.object({
  expiresAt: timestampSchema,
  retentionDays: z.number().int().positive(),
});
export type ArtifactRetention = z.infer<typeof artifactRetentionSchema>;

/** Metadata for a retained file output produced by an Export. */
export const artifactDescriptorSchema = versionedContractSchema.extend({
  id: artifactIdSchema,
  pipelineId: pipelineIdSchema,
  runId: runIdSchema,
  format: z.string().min(1),
  contentType: z.string().min(1).optional(),
  fileName: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  storage: storageDescriptorSchema,
  createdAt: timestampSchema,
  retention: artifactRetentionSchema,
});
export type ArtifactDescriptor = z.infer<typeof artifactDescriptorSchema>;
