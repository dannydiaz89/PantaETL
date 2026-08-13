import { z } from "zod";

import { dataFamilySchema, versionSchema } from "../common/primitives.js";

/** Component categories that participate in the Source → Transform → Export flow. */
export const componentKindSchema = z.enum(["source", "transform", "export"]);
export type ComponentKind = z.infer<typeof componentKindSchema>;

/** Stable, human-readable component identifier such as `source.csv`. */
export const componentTypeSchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/);
export type ComponentType = z.infer<typeof componentTypeSchema>;

/** Translation key consumed by a caller-owned localization layer. */
export const translationKeySchema = z.string().min(1);
export type TranslationKey = z.infer<typeof translationKeySchema>;

/** Supported field controls for generated component configuration forms. */
export const configFieldTypeSchema = z.enum([
  "text",
  "textarea",
  "number",
  "boolean",
  "select",
  "json",
]);
export type ConfigFieldType = z.infer<typeof configFieldTypeSchema>;

/** A selectable configuration value and its localized label. */
export const configOptionSchema = z.object({
  value: z.string().min(1),
  labelKey: translationKeySchema,
});
export type ConfigOption = z.infer<typeof configOptionSchema>;

/** Metadata needed to render and validate one component configuration field. */
export const configFieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-zA-Z0-9_]*$/),
  type: configFieldTypeSchema,
  labelKey: translationKeySchema,
  descriptionKey: translationKeySchema.optional(),
  required: z.boolean(),
  secret: z.boolean(),
  options: z.array(configOptionSchema).optional(),
});
export type ConfigField = z.infer<typeof configFieldSchema>;

/**
 * Component metadata shared by registries and configuration UIs.
 *
 * This schema describes capabilities and presentation metadata only; it does
 * not contain an executor or any UI implementation.
 */
export const componentMetadataSchema = z.object({
  kind: componentKindSchema,
  type: componentTypeSchema,
  version: versionSchema,
  displayNameKey: translationKeySchema,
  descriptionKey: translationKeySchema,
  configFields: z.array(configFieldSchema),
  inputFamilies: z.array(dataFamilySchema),
  outputFamilies: z.array(dataFamilySchema),
});
export type ComponentMetadata = z.infer<typeof componentMetadataSchema>;
