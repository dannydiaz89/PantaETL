import type { Pipeline } from "@pantaetl/contracts";
import { claimStagedUploads, type DatabaseClient } from "@pantaetl/database";

import { IMPORT_DIRECTORY } from "./import-storage.js";

/** The prefix every browser-supplied import carries, distinguishing it from a hand-placed file. */
const UPLOAD_PATH_PREFIX = "uploads/";

/**
 * Stops retention from collecting the files a saved pipeline now reads.
 *
 * Staged uploads expire on a timer, so a file left staged after a pipeline
 * started depending on it would be deleted and break that pipeline's next run.
 * Saving is the moment the dependency becomes durable, so it is the moment the
 * file stops being disposable. Only paths carrying the upload prefix are
 * considered, so a hand-placed import a pipeline happens to name is never
 * mistaken for staged state. Failure to release is deliberately not fatal to the
 * save: the pipeline is already persisted, and a still-staged file is recoverable
 * while a rejected save would lose the operator's work.
 */
export async function claimPipelineUploads(
  database: DatabaseClient,
  ownerUserId: string,
  pipeline: Pipeline,
): Promise<void> {
  const locations = uploadStorageLocations(pipeline);
  if (locations.length === 0) return;

  try {
    await claimStagedUploads(database, ownerUserId, locations);
  } catch {
    // The pipeline is saved; the file remains staged and collectable rather than lost.
  }
}

/** Collects the storage locations of every uploaded file this pipeline's steps name. */
function uploadStorageLocations(pipeline: Pipeline): string[] {
  const locations = new Set<string>();

  for (const step of pipeline.steps) {
    for (const value of Object.values(step.configuration.values)) {
      if (typeof value === "string" && value.startsWith(UPLOAD_PATH_PREFIX)) {
        locations.add(`${IMPORT_DIRECTORY}/${value}`);
      }
    }
  }

  return [...locations];
}
