import { describe, expect, it } from "vitest";

import { getSystemHealth, loadSystemHealthConfig } from "../src/system/health.js";

const healthConfig = {
  garbageCollectorHealthUrl: "http://garbage-collector.test/health",
  schedulerHealthUrl: "http://scheduler.test/health",
  storageRoot: "/application/storage",
  workerHealthUrl: "http://worker.test/health",
};

function healthyDatabase() {
  return {
    execute: async () => [],
    select: () => ({
      from: () => ({
        where: async () => [{ total: 3 }],
      }),
    }),
  } as never;
}

describe("system health aggregation", () => {
  it("reports only application availability and safe queue totals", async () => {
    const requests: string[] = [];
    const health = await getSystemHealth({
      config: healthConfig,
      database: healthyDatabase(),
      fetch: async (url) => {
        requests.push(url);
        const service = new URL(url).hostname.replace(".test", "");
        return { json: async () => ({ service, status: "ok" }), ok: true };
      },
      now: () => new Date("2026-08-13T12:00:00.000Z"),
      storageAccess: async () => undefined,
    });

    expect(health).toEqual({
      checkedAt: "2026-08-13T12:00:00.000Z",
      database: { status: "healthy" },
      garbageCollector: { status: "healthy" },
      queue: { queuedJobs: 3, runningJobs: 3, status: "healthy" },
      scheduler: { status: "healthy" },
      status: "healthy",
      storage: { status: "healthy" },
      workers: { status: "healthy" },
    });
    expect(requests).toEqual([
      healthConfig.schedulerHealthUrl,
      healthConfig.workerHealthUrl,
      healthConfig.garbageCollectorHealthUrl,
    ]);
    expect(JSON.stringify(health)).not.toMatch(/cpu|memory|disk|container|host/i);
  });

  it("degrades unavailable services without exposing failure details or queue counts", async () => {
    const health = await getSystemHealth({
      config: healthConfig,
      database: {
        execute: async () => {
          throw new Error("database endpoint");
        },
        select: () => {
          throw new Error("queue endpoint");
        },
      } as never,
      fetch: async () => ({ json: async () => ({ service: "worker", status: "ok" }), ok: true }),
      storageAccess: async () => {
        throw new Error("not writable");
      },
    });

    expect(health.database).toEqual({ status: "unavailable" });
    expect(health.queue).toEqual({ status: "unavailable" });
    expect(health.scheduler).toEqual({ status: "unavailable" });
    expect(health.workers).toEqual({ status: "healthy" });
    expect(health.garbageCollector).toEqual({ status: "unavailable" });
    expect(health.storage).toEqual({ status: "unavailable" });
    expect(health.status).toBe("degraded");
  });

  it("requires credential-free HTTP health URLs", () => {
    expect(loadSystemHealthConfig({
      GARBAGE_COLLECTOR_HEALTH_URL: "https://garbage-collector.test/health",
      SCHEDULER_HEALTH_URL: "https://scheduler.test/health",
      WORKER_HEALTH_URL: "https://worker.test/health",
    })).toMatchObject({ schedulerHealthUrl: "https://scheduler.test/health" });
    expect(() => loadSystemHealthConfig({ SCHEDULER_HEALTH_URL: "https://user:secret@scheduler.test/health" })).toThrow(
      "SCHEDULER_HEALTH_URL",
    );
    expect(() => loadSystemHealthConfig({ WORKER_HEALTH_URL: "https://worker.test/other" })).toThrow(
      "WORKER_HEALTH_URL",
    );
  });
});
