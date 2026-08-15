import { constants } from "node:fs";
import { access } from "node:fs/promises";

import { count, eq, sql } from "drizzle-orm";

import { resolveStorageRoot } from "@pantaetl/config";
import { jobs, type DatabaseClient } from "@pantaetl/database";

import type { HealthComponent, QueueHealth, SystemHealth } from "./types.js";

export type { HealthComponent, HealthStatus, QueueHealth, SystemHealth } from "./types.js";

/** Server-only configuration for the service readiness boundaries. */
export interface SystemHealthConfig {
  readonly garbageCollectorHealthUrl: string;
  readonly schedulerHealthUrl: string;
  readonly storageRoot: string;
  readonly workerHealthUrl: string;
}

/** Narrow response shape needed from an application service health endpoint. */
export interface HealthHttpResponse {
  readonly ok: boolean;
  json(): Promise<unknown>;
}

/** Dependencies used to query application status without binding tests to network or disk. */
export interface SystemHealthDependencies {
  readonly config: SystemHealthConfig;
  readonly database: DatabaseClient;
  readonly fetch: (url: string, init: RequestInit) => Promise<HealthHttpResponse>;
  readonly now?: () => Date;
  readonly storageAccess?: (path: string, mode: number) => Promise<void>;
}

/** Read system-health configuration while preventing credential-bearing probe URLs. */
export function loadSystemHealthConfig(environment: NodeJS.ProcessEnv = process.env): SystemHealthConfig {
  return {
    garbageCollectorHealthUrl: readHealthUrl(
      environment.GARBAGE_COLLECTOR_HEALTH_URL,
      "GARBAGE_COLLECTOR_HEALTH_URL",
      "http://127.0.0.1:3011/health",
    ),
    schedulerHealthUrl: readHealthUrl(
      environment.SCHEDULER_HEALTH_URL,
      "SCHEDULER_HEALTH_URL",
      "http://127.0.0.1:3010/health",
    ),
    storageRoot: resolveStorageRoot(environment),
    workerHealthUrl: readHealthUrl(
      environment.WORKER_HEALTH_URL,
      "WORKER_HEALTH_URL",
      "http://127.0.0.1:3020/health",
    ),
  };
}

/** Collect safe, application-level readiness and queue information concurrently. */
export async function getSystemHealth(dependencies: SystemHealthDependencies): Promise<SystemHealth> {
  const { config, database, fetch: fetchHealth, now = () => new Date(), storageAccess = access } = dependencies;
  const [databaseHealth, queue, scheduler, workers, garbageCollector, storage] = await Promise.all([
    checkDatabase(database),
    getQueueHealth(database),
    checkService(fetchHealth, config.schedulerHealthUrl, "scheduler"),
    checkService(fetchHealth, config.workerHealthUrl, "worker"),
    checkService(fetchHealth, config.garbageCollectorHealthUrl, "garbage-collector"),
    checkStorage(storageAccess, config.storageRoot),
  ]);

  const components = [databaseHealth, queue, scheduler, workers, garbageCollector, storage];
  return {
    checkedAt: now().toISOString(),
    database: databaseHealth,
    garbageCollector,
    queue,
    scheduler,
    status: components.every((component) => component.status === "healthy") ? "healthy" : "degraded",
    storage,
    workers,
  };
}

/** Verify PostgreSQL availability without returning server, version, or capacity metadata. */
async function checkDatabase(database: DatabaseClient): Promise<HealthComponent> {
  try {
    await database.execute(sql`select 1`);
    return { status: "healthy" };
  } catch {
    return { status: "unavailable" };
  }
}

/** Return queued and active-job totals only when PostgreSQL can complete both count queries. */
async function getQueueHealth(database: DatabaseClient): Promise<QueueHealth> {
  try {
    const [queued, running] = await Promise.all([
      database.select({ total: count() }).from(jobs).where(eq(jobs.state, "queued")),
      database.select({ total: count() }).from(jobs).where(eq(jobs.state, "running")),
    ]);
    return {
      queuedJobs: Number(queued[0]?.total ?? 0),
      runningJobs: Number(running[0]?.total ?? 0),
      status: "healthy",
    };
  } catch {
    return { status: "unavailable" };
  }
}

/** Probe a declared application health endpoint and accept only its matching safe response. */
async function checkService(
  fetchHealth: SystemHealthDependencies["fetch"],
  url: string,
  expectedService: string,
): Promise<HealthComponent> {
  try {
    const response = await fetchHealth(url, { signal: AbortSignal.timeout(2_000) });
    const payload: unknown = await response.json();
    if (response.ok && isHealthyService(payload, expectedService)) {
      return { status: "healthy" };
    }
  } catch {
    // Endpoint failures are deliberately represented as state, never exposed as infrastructure detail.
  }

  return { status: "unavailable" };
}

/** Check configured application storage read/write access without collecting filesystem metrics. */
async function checkStorage(
  storageAccess: NonNullable<SystemHealthDependencies["storageAccess"]>,
  storageRoot: string,
): Promise<HealthComponent> {
  try {
    await storageAccess(storageRoot, constants.R_OK | constants.W_OK);
    return { status: "healthy" };
  } catch {
    return { status: "unavailable" };
  }
}

/** Verify that a service reports its own expected identity and readiness state. */
function isHealthyService(value: unknown, expectedService: string): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const payload = value as { service?: unknown; status?: unknown };
  return payload.service === expectedService && payload.status === "ok";
}

/** Parse an internal health URL without permitting credentials, query data, or arbitrary paths. */
function readHealthUrl(value: string | undefined, variableName: string, fallback: string): string {
  let url: URL;
  try {
    url = new URL(value?.trim() || fallback);
  } catch {
    throw new Error(`${variableName} must be a valid HTTP health URL.`);
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.pathname !== "/health" ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw new Error(`${variableName} must be a credential-free HTTP health URL ending in /health.`);
  }

  return url.toString();
}
