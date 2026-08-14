import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "../src/client.js";
import {
  createStagedUpload,
  listExpiredArtifacts,
  listExpiredDatasets,
  listExpiredRunLogs,
  listExpiredRuns,
  listExpiredStagedUploads,
} from "../src/retention.js";

const database = {} as DatabaseClient;
const now = new Date("2026-08-13T00:00:00.000Z");

describe("retention query boundary", () => {
  it.each([
    ["datasets", listExpiredDatasets],
    ["artifacts", listExpiredArtifacts],
    ["runs", listExpiredRuns],
    ["run logs", listExpiredRunLogs],
    ["staged uploads", listExpiredStagedUploads],
  ])("rejects an unbounded %s retention read", async (_name, listExpired) => {
    await expect(listExpired(database, now, 0)).rejects.toThrow("Retention batch size must be a positive integer.");
  });

  it("records the owner and expiry that make a staged upload collectable", async () => {
    const values = vi.fn().mockReturnValue({ returning: () => Promise.resolve([{ id: uploadId }]) });
    const db = { insert: vi.fn().mockReturnValue({ values }) } as unknown as DatabaseClient;

    await expect(createStagedUpload(db, stagedUpload)).resolves.toEqual({ id: uploadId });
    expect(values).toHaveBeenCalledWith(stagedUpload);
  });

  it("refuses to report a staged upload the database did not record", async () => {
    const db = {
      insert: () => ({ values: () => ({ returning: () => Promise.resolve([]) }) }),
    } as unknown as DatabaseClient;

    await expect(createStagedUpload(db, stagedUpload)).rejects.toThrow(
      "Staged upload metadata could not be recorded.",
    );
  });
});

const uploadId = "723e4567-e89b-12d3-a456-426614174000";
const stagedUpload = {
  expiresAt: new Date("2026-08-14T00:00:00.000Z"),
  ownerUserId: "123e4567-e89b-12d3-a456-426614174000",
  storageKind: "local",
  storageLocation: "imports/uploads/staged.csv",
} as const;
