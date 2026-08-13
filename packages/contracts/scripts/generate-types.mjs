import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";

import { compileFromFile } from "json-schema-to-typescript";

const schemaDirectory = fileURLToPath(
  new URL("../../../schemas/contracts/", import.meta.url),
);
const outputDirectory = fileURLToPath(new URL("../src/generated/", import.meta.url));

const schemas = [
  "artifact-descriptor",
  "common",
  "component-metadata",
  "dataset-descriptor",
  "job",
  "pipeline",
  "run",
  "source-execution-request",
];

await mkdir(outputDirectory, { recursive: true });

for (const name of schemas) {
  const output = await compileFromFile(`${schemaDirectory}${name}.schema.json`, {
    bannerComment:
      "/* This file is generated from the canonical JSON Schema. Do not edit it manually. */",
    format: false,
    style: { singleQuote: true },
  });

  await writeFile(`${outputDirectory}${name}.ts`, output);
}
