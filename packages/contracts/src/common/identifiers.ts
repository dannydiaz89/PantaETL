import { z } from "zod";

/** Base runtime validator for UUID-backed platform identifiers. */
export const identifierSchema = z.string().uuid();

/** TypeScript representation of a platform identifier. */
export type Identifier = z.infer<typeof identifierSchema>;

/** Runtime validator for pipeline identifiers. */
export const pipelineIdSchema = identifierSchema.brand<"PipelineId">();
export type PipelineId = z.infer<typeof pipelineIdSchema>;

/** Runtime validator for run identifiers. */
export const runIdSchema = identifierSchema.brand<"RunId">();
export type RunId = z.infer<typeof runIdSchema>;

/** Runtime validator for queue job identifiers. */
export const jobIdSchema = identifierSchema.brand<"JobId">();
export type JobId = z.infer<typeof jobIdSchema>;

/** Runtime validator for temporary dataset identifiers. */
export const datasetIdSchema = identifierSchema.brand<"DatasetId">();
export type DatasetId = z.infer<typeof datasetIdSchema>;

/** Runtime validator for retained artifact identifiers. */
export const artifactIdSchema = identifierSchema.brand<"ArtifactId">();
export type ArtifactId = z.infer<typeof artifactIdSchema>;

/** Runtime validator for user identifiers. */
export const userIdSchema = identifierSchema.brand<"UserId">();
export type UserId = z.infer<typeof userIdSchema>;

/** Runtime validator for Source, Transform, and Export component identifiers. */
export const componentIdSchema = identifierSchema.brand<"ComponentId">();
export type ComponentId = z.infer<typeof componentIdSchema>;

/** Runtime validator for Source checkpoint identifiers. */
export const checkpointIdSchema = identifierSchema.brand<"CheckpointId">();
export type CheckpointId = z.infer<typeof checkpointIdSchema>;
