/** The safe availability state returned for one application dependency. */
export type HealthStatus = "healthy" | "unavailable";

/** Availability information without transport details, host metadata, or error text. */
export interface HealthComponent {
  readonly status: HealthStatus;
}

/** Queue availability and aggregate work counts safe to expose in system status. */
export interface QueueHealth extends HealthComponent {
  readonly queuedJobs?: number;
  readonly runningJobs?: number;
}

/** Application-level system status for the control plane. */
export interface SystemHealth {
  readonly checkedAt: string;
  readonly database: HealthComponent;
  readonly garbageCollector: HealthComponent;
  readonly queue: QueueHealth;
  readonly scheduler: HealthComponent;
  readonly status: "healthy" | "degraded";
  readonly storage: HealthComponent;
  readonly workers: HealthComponent;
}
