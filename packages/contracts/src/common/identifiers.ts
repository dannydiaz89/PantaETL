import { canonicalSchemas, propertySchema, zodFromJsonSchema } from "../json-schema.js";

/** Base runtime validator for UUID-backed platform identifiers. */
export const identifierSchema = zodFromJsonSchema(
  propertySchema(canonicalSchemas.common, "identifier"),
);

/** TypeScript representation of a platform identifier. */
export type Identifier = string;

/** Runtime validator for pipeline identifiers. */
export const pipelineIdSchema = identifierSchema;
export type PipelineId = Identifier;

/** Runtime validator for run identifiers. */
export const runIdSchema = identifierSchema;
export type RunId = Identifier;

/** Runtime validator for queue job identifiers. */
export const jobIdSchema = identifierSchema;
export type JobId = Identifier;

/** Runtime validator for temporary dataset identifiers. */
export const datasetIdSchema = identifierSchema;
export type DatasetId = Identifier;

/** Runtime validator for retained artifact identifiers. */
export const artifactIdSchema = identifierSchema;
export type ArtifactId = Identifier;

/** Runtime validator for user identifiers. */
export const userIdSchema = identifierSchema;
export type UserId = Identifier;

/** Runtime validator for Source, Transform, and Export component identifiers. */
export const componentIdSchema = identifierSchema;
export type ComponentId = Identifier;

/** Runtime validator for Source checkpoint identifiers. */
export const checkpointIdSchema = identifierSchema;
export type CheckpointId = Identifier;
