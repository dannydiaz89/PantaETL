import { describe, expect, it, vi } from "vitest";

import { PipelineActionConflictError, type DatabaseClient } from "@pantaetl/database";

import { createInternalPipelineRunRouteHandler } from "../src/internal-run-route.js";

const ids = {
  pipeline: "123e4567-e89b-12d3-a456-426614174001",
  run: "123e4567-e89b-12d3-a456-426614174002",
  user: "123e4567-e89b-12d3-a456-426614174003",
};
const internalToken = "scheduler-internal-token-for-tests-123456";

describe("internal pipeline run route", () => {
  it("rejects missing or invalid internal credentials before attempting scheduling work", async () => {
    const enqueue = vi.fn();
    const handler = createHandler(enqueue);

    await expect(handler(request({}))).resolves.toMatchObject({ status: 401 });
    await expect(handler(request({ authorization: "Bearer incorrect" }))).resolves.toMatchObject({ status: 401 });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("enqueues a validated owner-scoped manual run for the authenticated control plane", async () => {
    const enqueue = vi.fn().mockResolvedValue({
      initialJobCount: 1,
      pipelineId: ids.pipeline,
      queuedBehindActiveRun: false,
      runId: ids.run,
    });
    const handler = createHandler(enqueue);

    const response = await handler(request({ authorization: `Bearer ${internalToken}` }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      initialJobCount: 1,
      pipelineId: ids.pipeline,
      queuedBehindActiveRun: false,
      runId: ids.run,
    });
    expect(enqueue).toHaveBeenCalledWith(expect.anything(), {
      ownerUserId: ids.user,
      pipelineId: ids.pipeline,
    });
  });

  it("rejects request fields beyond the two trusted scheduling identifiers", async () => {
    const enqueue = vi.fn();
    const handler = createHandler(enqueue);
    const response = await handler(new Request("http://scheduler/internal/pipeline-runs", {
      body: JSON.stringify({ ownerUserId: ids.user, pipelineId: ids.pipeline, secret: "not-accepted" }),
      headers: { authorization: `Bearer ${internalToken}`, "content-type": "application/json" },
      method: "POST",
    }));

    expect(response.status).toBe(400);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("returns a safe conflict for an invalid run state", async () => {
    const enqueue = vi.fn().mockRejectedValue(new PipelineActionConflictError(
      "not_enabled",
      "The pipeline must be enabled before it can run.",
    ));
    const handler = createHandler(enqueue);

    const response = await handler(request({ authorization: `Bearer ${internalToken}` }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ code: "pipeline_not_enabled" });
  });
});

/** Creates an isolated internal endpoint with scheduler persistence replaced by a test double. */
function createHandler(enqueuePipelineRunForOwner: ReturnType<typeof vi.fn>) {
  return createInternalPipelineRunRouteHandler({
    database: {} as DatabaseClient,
    enqueuePipelineRunForOwner: enqueuePipelineRunForOwner as never,
    internalToken,
  });
}

/** Creates an authenticated scheduler request with no data beyond trusted owner and pipeline identifiers. */
function request(headers: Record<string, string>): Request {
  return new Request("http://scheduler/internal/pipeline-runs", {
    body: JSON.stringify({ ownerUserId: ids.user, pipelineId: ids.pipeline }),
    headers: { "content-type": "application/json", ...headers },
    method: "POST",
  });
}
