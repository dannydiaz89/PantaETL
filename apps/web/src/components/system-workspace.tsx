import { useCallback, useEffect, useState } from "react";

import { Button } from "@pantaetl/ui";

import { useI18n } from "../locale-provider.js";
import { type HealthComponent, type HealthStatus, type SystemHealth } from "../system/types.js";

interface HealthLoadState {
  readonly health: SystemHealth | null;
  readonly status: "error" | "loading" | "ready";
}

const initialHealthLoadState: HealthLoadState = { health: null, status: "loading" };

/** Displays safe service readiness and aggregate queue totals from the authenticated health API. */
export function SystemWorkspace() {
  const { formatDate, formatNumber, t } = useI18n();
  const [loadState, setLoadState] = useState<HealthLoadState>(initialHealthLoadState);

  const loadHealth = useCallback(async () => {
    setLoadState((current) => ({ ...current, status: "loading" }));
    try {
      const response = await fetch("/api/system/health", { credentials: "same-origin" });
      if (!response.ok) {
        throw new Error("System health could not be loaded.");
      }
      setLoadState({ health: parseSystemHealth(await response.json()), status: "ready" });
    } catch {
      setLoadState({ health: null, status: "error" });
    }
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  const health = loadState.health;
  return (
    <section aria-labelledby="system-health-title" className="system-workspace">
      <div className="system-workspace__heading">
        <div>
          <h2 id="system-health-title">{t("system.health.title")}</h2>
          <p>{t("system.health.description")}</p>
        </div>
        <Button disabled={loadState.status === "loading"} onClick={() => void loadHealth()} variant="secondary">
          {loadState.status === "loading" ? t("system.health.loading") : t("system.health.refresh")}
        </Button>
      </div>
      {loadState.status === "error" ? <p className="system-workspace__message" role="status">{t("system.health.unavailable")}</p> : null}
      {health === null ? null : (
        <>
          <div className="system-summary" role="status">
            <span className={`system-status system-status--${health.status}`}>{t(`system.status.${health.status}`)}</span>
            <span>{t("system.health.checkedAt")}: {formatDate(health.checkedAt, { dateStyle: "medium", timeStyle: "short" })}</span>
          </div>
          <dl className="system-components">
            <HealthRow label={t("system.component.database")} component={health.database} />
            <HealthRow label={t("system.component.scheduler")} component={health.scheduler} />
            <HealthRow label={t("system.component.workers")} component={health.workers} />
            <HealthRow label={t("system.component.garbageCollector")} component={health.garbageCollector} />
            <HealthRow label={t("system.component.storage")} component={health.storage} />
          </dl>
          <section aria-labelledby="system-queue-title" className="system-queue">
            <h3 id="system-queue-title">{t("system.queue.title")}</h3>
            <p>{t("system.queue.description")}</p>
            <dl>
              <div><dt>{t("system.queue.queued")}</dt><dd>{health.queue.queuedJobs === undefined ? t("system.queue.notAvailable") : formatNumber(health.queue.queuedJobs)}</dd></div>
              <div><dt>{t("system.queue.running")}</dt><dd>{health.queue.runningJobs === undefined ? t("system.queue.notAvailable") : formatNumber(health.queue.runningJobs)}</dd></div>
            </dl>
          </section>
        </>
      )}
    </section>
  );

  function HealthRow({ component, label }: { readonly component: HealthComponent; readonly label: string }) {
    return <div><dt>{label}</dt><dd><span className={`system-status system-status--${component.status}`}>{t(`system.status.${component.status}`)}</span></dd></div>;
  }
}

/** Validates the intentionally small, safe health response before rendering it in the browser. */
export function parseSystemHealth(value: unknown): SystemHealth {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("System health response must be an object.");
  }

  const source = value as Record<string, unknown>;
  const checkedAt = source.checkedAt;
  const status = parseOverallStatus(source.status);
  if (typeof checkedAt !== "string" || Number.isNaN(new Date(checkedAt).valueOf())) {
    throw new Error("System health response must include a valid check time.");
  }

  return {
    checkedAt,
    database: parseComponent(source.database),
    garbageCollector: parseComponent(source.garbageCollector),
    queue: parseQueue(source.queue),
    scheduler: parseComponent(source.scheduler),
    status,
    storage: parseComponent(source.storage),
    workers: parseComponent(source.workers),
  };
}

/** Reads one component state without permitting transport or infrastructure metadata. */
function parseComponent(value: unknown): HealthComponent {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("System health response contains an invalid component.");
  }
  return { status: parseHealthStatus((value as { status?: unknown }).status) };
}

/** Reads safe queue counts without accepting arbitrary metrics. */
function parseQueue(value: unknown): SystemHealth["queue"] {
  const component = parseComponent(value);
  const source = value as { queuedJobs?: unknown; runningJobs?: unknown };
  return {
    ...(isSafeCount(source.queuedJobs) ? { queuedJobs: source.queuedJobs } : {}),
    ...(isSafeCount(source.runningJobs) ? { runningJobs: source.runningJobs } : {}),
    status: component.status,
  };
}

function parseHealthStatus(value: unknown): HealthStatus {
  if (value === "healthy" || value === "unavailable") {
    return value;
  }
  throw new Error("System health response contains an invalid availability state.");
}

function parseOverallStatus(value: unknown): SystemHealth["status"] {
  if (value === "healthy" || value === "degraded") {
    return value;
  }
  throw new Error("System health response contains an invalid overall state.");
}

function isSafeCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
