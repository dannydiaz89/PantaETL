import { mkdir, readFile, writeFile } from "node:fs/promises";
import process from "node:process";
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

const checkOnly = process.argv.includes("--check");
const staleFiles = [];

if (!checkOnly) {
  await mkdir(outputDirectory, { recursive: true });
}

for (const name of schemas) {
  const output = await compileFromFile(`${schemaDirectory}${name}.schema.json`, {
    bannerComment:
      "/* This file is generated from the canonical JSON Schema. Do not edit it manually. */",
    format: false,
    style: { singleQuote: true },
  });

  const outputPath = `${outputDirectory}${name}.ts`;

  if (checkOnly) {
    try {
      const currentOutput = await readFile(outputPath, "utf8");
      if (currentOutput !== output) {
        staleFiles.push(name);
      }
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        staleFiles.push(name);
        continue;
      }

      throw error;
    }
  } else {
    await writeFile(outputPath, output);
  }
}

if (staleFiles.length > 0) {
  throw new Error(
    `Generated TypeScript contract types are stale: ${staleFiles.join(", ")}. Run pnpm generate.`,
  );
}
