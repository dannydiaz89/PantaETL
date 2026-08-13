import type { ComponentMetadata } from "../generated/component-metadata.js";
import {
  arrayItemSchema,
  canonicalSchemas,
  propertySchema,
  zodFromJsonSchema,
} from "../json-schema.js";

const configFieldsSchema = propertySchema(canonicalSchemas.componentMetadata, "configFields");
const configFieldJsonSchema = arrayItemSchema(configFieldsSchema);
const configOptionsSchema = propertySchema(configFieldJsonSchema, "options");

/** Runtime validator derived from the canonical component metadata JSON Schema. */
export const componentMetadataSchema = zodFromJsonSchema(canonicalSchemas.componentMetadata);

/** Runtime validator for component categories. */
export const componentKindSchema = zodFromJsonSchema(
  propertySchema(canonicalSchemas.componentMetadata, "kind"),
);
export type ComponentKind = ComponentMetadata["kind"];

/** Runtime validator for stable component type names. */
export const componentTypeSchema = zodFromJsonSchema(
  propertySchema(canonicalSchemas.componentMetadata, "type"),
);
export type ComponentType = ComponentMetadata["type"];

/** Runtime validator for localized display and description keys. */
export const translationKeySchema = zodFromJsonSchema(
  propertySchema(canonicalSchemas.componentMetadata, "displayNameKey"),
);
export type TranslationKey = ComponentMetadata["displayNameKey"];

/** Runtime validator for component configuration field metadata. */
export const configFieldSchema = zodFromJsonSchema(configFieldJsonSchema);
export type ConfigField = ComponentMetadata["configFields"][number];

/** Runtime validator for configuration field control types. */
export const configFieldTypeSchema = zodFromJsonSchema(
  propertySchema(configFieldJsonSchema, "type"),
);
export type ConfigFieldType = ConfigField["type"];

/** Runtime validator for selectable configuration options. */
export const configOptionSchema = zodFromJsonSchema(arrayItemSchema(configOptionsSchema));
export type ConfigOption = NonNullable<ConfigField["options"]>[number];

export type { ComponentMetadata } from "../generated/component-metadata.js";
