import { describe, expect, it } from "vitest";

import type { DatabaseClient } from "../src/client.js";
import {
  listExpiredArtifacts,
  listExpiredDatasets,
  listExpiredRunLogs,
  listExpiredRuns,
} from "../src/retention.js";

const database = {} as DatabaseClient;
const now = new Date("2026-08-13T00:00:00.000Z");

describe("retention query boundary", () => {
  it.each([
    ["datasets", listExpiredDatasets],
    ["artifacts", listExpiredArtifacts],
    ["runs", listExpiredRuns],
    ["run logs", listExpiredRunLogs],
  ])("rejects an unbounded %s retention read", async (_name, listExpired) => {
    await expect(listExpired(database, now, 0)).rejects.toThrow("Retention batch size must be a positive integer.");
  });
});
