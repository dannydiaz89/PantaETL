import { Ajv2020 } from "ajv/dist/2020.js";
import { z } from "zod";

import artifactDescriptor from "../../../schemas/contracts/artifact-descriptor.schema.json" with { type: "json" };
import common from "../../../schemas/contracts/common.schema.json" with { type: "json" };
import componentMetadata from "../../../schemas/contracts/component-metadata.schema.json" with { type: "json" };
import datasetDescriptor from "../../../schemas/contracts/dataset-descriptor.schema.json" with { type: "json" };
import job from "../../../schemas/contracts/job.schema.json" with { type: "json" };
import pipeline from "../../../schemas/contracts/pipeline.schema.json" with { type: "json" };
import run from "../../../schemas/contracts/run.schema.json" with { type: "json" };
import sourceExecutionRequest from "../../../schemas/contracts/source-execution-request.schema.json" with { type: "json" };

type JsonSchema = Parameters<typeof z.fromJSONSchema>[0];

const schemaValidator = new Ajv2020({
  allErrors: true,
  strict: false,
  validateFormats: false,
});

/** Convert a canonical JSON Schema document or fragment into a runtime Zod validator. */
export function zodFromJsonSchema(schema: unknown): z.ZodType {
  const zodSchema = z.fromJSONSchema(schema as JsonSchema);
  const validate = schemaValidator.compile(schema as object);

  return zodSchema.superRefine((value, context) => {
    if (validate(value)) {
      return;
    }

    for (const error of validate.errors ?? []) {
      context.addIssue({
        code: "custom",
        message: `JSON Schema validation failed at ${error.instancePath || "/"}: ${error.message ?? "invalid value"}`,
      });
    }
  });
}

/** Canonical JSON Schema documents used to derive language-specific validators. */
export const canonicalSchemas = {
  artifactDescriptor,
  common,
  componentMetadata,
  datasetDescriptor,
  job,
  pipeline,
  run,
  sourceExecutionRequest,
} as const;

/** Return a property subschema from a canonical object schema. */
export function propertySchema(schema: unknown, propertyName: string): unknown {
  const properties = (schema as { properties?: Record<string, unknown> }).properties;
  const property = properties?.[propertyName];

  if (!property) {
    throw new Error(`Canonical JSON Schema is missing property ${propertyName}.`);
  }

  return retainDefinitions(schema, property);
}

/** Return the item subschema from a canonical array schema. */
export function arrayItemSchema(schema: unknown): unknown {
  const items = (schema as { items?: unknown }).items;

  if (!items) {
    throw new Error("Canonical JSON Schema is missing array items.");
  }

  return retainDefinitions(schema, items);
}

/** Retain local definitions when a referenced schema fragment is converted independently. */
function retainDefinitions(parent: unknown, fragment: unknown): unknown {
  if (typeof fragment !== "object" || fragment === null) {
    return fragment;
  }

  const parentRecord = parent as { $defs?: unknown; definitions?: unknown };
  const definitions = parentRecord.$defs ?? parentRecord.definitions;

  if (!definitions) {
    return fragment;
  }

  return {
    ...(fragment as Record<string, unknown>),
    $defs: definitions,
  };
}
