import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";

import { z } from "zod";

import { componentMetadataSchema } from "../dist/components/index.js";
import {
  artifactDescriptorSchema,
  datasetDescriptorSchema,
} from "../dist/dataset/index.js";
import { jobSchema, runSchema } from "../dist/execution/index.js";
import { pipelineSchema } from "../dist/pipeline/index.js";

const outputDirectory = fileURLToPath(
  new URL("../../../schemas/generated/", import.meta.url),
);

const schemas = [
  ["artifact-descriptor", artifactDescriptorSchema],
  ["component-metadata", componentMetadataSchema],
  ["dataset-descriptor", datasetDescriptorSchema],
  ["job", jobSchema],
  ["pipeline", pipelineSchema],
  ["run", runSchema],
];

await mkdir(outputDirectory, { recursive: true });

for (const [name, schema] of schemas) {
  const jsonSchema = z.toJSONSchema(schema, { target: "draft-2020-12" });
  jsonSchema.$id = `https://pantaetl.dev/schemas/${name}.schema.json`;

  await writeFile(
    new URL(`${name}.schema.json`, `file://${outputDirectory}`),
    `${JSON.stringify(jsonSchema, null, 2)}\n`,
  );
}
