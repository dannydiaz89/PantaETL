import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Where a packaged deployment keeps internal storage. */
export const PRODUCTION_STORAGE_ROOT = "/var/lib/pantaetl/storage";

/** The workspace-relative directory a development stack keeps internal storage in. */
export const DEVELOPMENT_STORAGE_DIRECTORY = "storage";

/** The file that marks the workspace root, used to locate the development storage directory. */
const WORKSPACE_MARKER = "pnpm-workspace.yaml";

/** Which deployment shape a process is running as. */
export type RuntimeEnvironment = "development" | "production";

/**
 * Reads the deployment shape, treating anything unrecognized as production.
 *
 * Production is the default so that a deployment which forgets the variable
 * cannot silently start writing into a working copy, and a typo cannot quietly
 * downgrade a real deployment.
 */
export function resolveRuntimeEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): RuntimeEnvironment {
  return environment.PANTAETL_ENV?.trim().toLowerCase() === "development"
    ? "development"
    : "production";
}

/**
 * Resolves the internal storage root every service must agree on.
 *
 * Web, worker, and collector all read and write one tree: a file one service
 * accepts is read by another and deleted by a third, so a disagreement here
 * looks like data loss rather than a misconfiguration. Resolution is therefore
 * derived identically everywhere instead of being defaulted per service.
 *
 * An explicit `STORAGE_ROOT` always wins, so a deployment can mount storage
 * anywhere. Otherwise a development process uses a directory inside the
 * workspace, which an ordinary account can write, and everything else uses the
 * packaged location.
 */
export function resolveStorageRoot(environment: NodeJS.ProcessEnv = process.env): string {
  const configured = environment.STORAGE_ROOT?.trim();
  if (configured) return resolve(configured);

  return resolveRuntimeEnvironment(environment) === "development"
    ? join(workspaceRoot(), DEVELOPMENT_STORAGE_DIRECTORY)
    : PRODUCTION_STORAGE_ROOT;
}

/**
 * Finds the workspace root by walking up from this module rather than the
 * working directory.
 *
 * Services are started from different directories, and resolving against the
 * current one would give each of them a different storage root. This module's
 * own location is the same for all of them. Falls back to the working directory
 * only when the marker is absent, which means the package is running outside the
 * workspace and should have been given an explicit `STORAGE_ROOT`.
 */
function workspaceRoot(): string {
  let directory = dirname(fileURLToPath(import.meta.url));

  for (;;) {
    if (existsSync(join(directory, WORKSPACE_MARKER))) return directory;

    const parent = dirname(directory);
    if (parent === directory) return process.cwd();
    directory = parent;
  }
}
