import { tmpdir } from "node:os";
import { isAbsolute } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEVELOPMENT_STORAGE_DIRECTORY,
  PRODUCTION_STORAGE_ROOT,
  resolveRuntimeEnvironment,
  resolveStorageRoot,
} from "../src/storage.js";

describe("runtime environment", () => {
  it("treats only an explicit development value as development", () => {
    expect(resolveRuntimeEnvironment({ PANTAETL_ENV: "development" })).toBe("development");
    expect(resolveRuntimeEnvironment({ PANTAETL_ENV: "  DEVELOPMENT  " })).toBe("development");
  });

  it("treats an absent, empty, or misspelled value as production", () => {
    expect(resolveRuntimeEnvironment({})).toBe("production");
    expect(resolveRuntimeEnvironment({ PANTAETL_ENV: "" })).toBe("production");
    expect(resolveRuntimeEnvironment({ PANTAETL_ENV: "dev" })).toBe("production");
    expect(resolveRuntimeEnvironment({ PANTAETL_ENV: "developmnet" })).toBe("production");
  });
});

describe("storage root", () => {
  it("uses the packaged location when nothing selects otherwise", () => {
    expect(resolveStorageRoot({})).toBe(PRODUCTION_STORAGE_ROOT);
  });

  it("keeps a real deployment out of a working copy when the flag is malformed", () => {
    expect(resolveStorageRoot({ PANTAETL_ENV: "Production" })).toBe(PRODUCTION_STORAGE_ROOT);
    expect(resolveStorageRoot({ PANTAETL_ENV: "dev" })).toBe(PRODUCTION_STORAGE_ROOT);
  });

  it("uses a workspace directory for a development process", () => {
    const root = resolveStorageRoot({ PANTAETL_ENV: "development" });

    expect(isAbsolute(root)).toBe(true);
    expect(root.endsWith(`${DEVELOPMENT_STORAGE_DIRECTORY}`)).toBe(true);
    expect(root).not.toBe(PRODUCTION_STORAGE_ROOT);
  });

  it("resolves the same development directory regardless of the working directory", () => {
    const resolved = resolveStorageRoot({ PANTAETL_ENV: "development" });
    const previous = process.cwd();

    try {
      // Services start from different directories, and one outside the
      // workspace is the case that would silently split them apart.
      process.chdir(tmpdir());
      expect(resolveStorageRoot({ PANTAETL_ENV: "development" })).toBe(resolved);
    } finally {
      process.chdir(previous);
    }
  });

  it("lets an explicit location win over the deployment shape", () => {
    expect(resolveStorageRoot({ PANTAETL_ENV: "development", STORAGE_ROOT: "/mnt/shared" }))
      .toBe("/mnt/shared");
    expect(resolveStorageRoot({ STORAGE_ROOT: "/mnt/shared" })).toBe("/mnt/shared");
  });

  it("ignores a blank explicit location rather than resolving to nothing", () => {
    expect(resolveStorageRoot({ STORAGE_ROOT: "   " })).toBe(PRODUCTION_STORAGE_ROOT);
  });
});
