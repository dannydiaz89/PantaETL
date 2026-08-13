import { describe, expect, it } from "vitest";

import { PipelineRunEnqueueConflictError, createPipelineRunInTransaction } from "../src/run-queue.js";

const pipelineId = "123e4567-e89b-12d3-a456-426614174301";

/** Build the minimal locked-pipeline query used before run persistence starts. */
function transactionWithPipelineState(state: string): never {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          for: () => ({
            limit: async () => [{ id: pipelineId, state }],
          }),
        }),
      }),
    }),
  } as never;
}

describe("createPipelineRunInTransaction", () => {
  it.each(["draft", "disabled"])("does not persist a run for a %s pipeline", async (state) => {
    await expect(
      createPipelineRunInTransaction(
        transactionWithPipelineState(state),
        { pipelineId },
        new Date("2026-08-13T00:00:00.000Z"),
      ),
    ).rejects.toThrow("Cannot create a run until the pipeline has been reviewed and enabled.");
  });

  it("exposes a stable reason when the pipeline cannot run", async () => {
    await expect(
      createPipelineRunInTransaction(
        transactionWithPipelineState("disabled"),
        { pipelineId },
        new Date("2026-08-13T00:00:00.000Z"),
      ),
    ).rejects.toMatchObject({
      name: "PipelineRunEnqueueConflictError",
      reason: "not_enabled",
    } satisfies Partial<PipelineRunEnqueueConflictError>);
  });
});
