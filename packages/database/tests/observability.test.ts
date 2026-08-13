import { describe, expect, it, vi } from "vitest";

import { recordOperationalEvent, validateOperationalEvent } from "../src/observability.js";
import type { DatabaseClient } from "../src/client.js";

const event = {
  event: "step_succeeded" as const,
  pipelineId: "123e4567-e89b-12d3-a456-426614174001",
  recordsRead: 12,
  recordsWritten: 12,
  runId: "123e4567-e89b-12d3-a456-426614174002",
  runStepId: "123e4567-e89b-12d3-a456-426614174003",
};

describe("operational event persistence", () => {
  it("persists correlation IDs and numeric counters without a free-form context", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const database = { insert: vi.fn(() => ({ values })) } as unknown as DatabaseClient;

    await recordOperationalEvent(database, event);

    expect(values).toHaveBeenCalledWith(event);
  });

  it("rejects negative, fractional, and unbounded metric values", () => {
    expect(() => validateOperationalEvent({ ...event, bytesRead: -1 })).toThrow("bytesRead");
    expect(() => validateOperationalEvent({ ...event, durationMs: 1.5 })).toThrow("durationMs");
    expect(() => validateOperationalEvent({ ...event, recordsRead: Number.MAX_SAFE_INTEGER + 1 })).toThrow(
      "recordsRead",
    );
  });
});
