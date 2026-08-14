import type { Trigger, WritablePipelineTrigger } from "@pantaetl/contracts";

/** Common schedule shapes the editor can present with friendly controls instead of raw cron. */
export type PipelineScheduleFrequency = "hourly" | "daily" | "weekly" | "custom";

/** One friendly schedule interpretation of a cron expression, or "custom" when none applies. */
export type PipelineFriendlySchedule =
  | { readonly frequency: "hourly"; readonly minute: number }
  | { readonly frequency: "daily"; readonly hour: number; readonly minute: number }
  | { readonly frequency: "weekly"; readonly dayOfWeek: number; readonly hour: number; readonly minute: number }
  | { readonly frequency: "custom"; readonly cron: string };

/** One Schedule trigger being edited, keyed by a draft-local id used only for list identity. */
export interface PipelineScheduleTriggerDraft {
  readonly cron: string;
  readonly enabled: boolean;
  readonly localId: string;
  readonly timezone: string;
}

/** Editable local state for a pipeline's manual and scheduled triggers. */
export interface PipelineTriggerDraft {
  readonly manualEnabled: boolean;
  readonly schedules: readonly PipelineScheduleTriggerDraft[];
}

const HOURLY_PATTERN = /^(\d{1,2}) \* \* \* \*$/;
const DAILY_PATTERN = /^(\d{1,2}) (\d{1,2}) \* \* \*$/;
const WEEKLY_PATTERN = /^(\d{1,2}) (\d{1,2}) \* \* (\d)$/;

/** Interpret a cron expression as a friendly schedule when it matches a common shape, else fall back to raw cron editing. */
export function friendlyScheduleFromCron(cron: string): PipelineFriendlySchedule {
  const hourly = HOURLY_PATTERN.exec(cron);
  if (hourly?.[1] !== undefined) {
    return { frequency: "hourly", minute: Number(hourly[1]) };
  }

  const weekly = WEEKLY_PATTERN.exec(cron);
  if (weekly?.[1] !== undefined && weekly[2] !== undefined && weekly[3] !== undefined) {
    return { frequency: "weekly", dayOfWeek: Number(weekly[3]), hour: Number(weekly[2]), minute: Number(weekly[1]) };
  }

  const daily = DAILY_PATTERN.exec(cron);
  if (daily?.[1] !== undefined && daily[2] !== undefined) {
    return { frequency: "daily", hour: Number(daily[2]), minute: Number(daily[1]) };
  }

  return { frequency: "custom", cron };
}

/** Render a friendly schedule back into the cron expression the backend stores. */
export function cronFromFriendlySchedule(schedule: PipelineFriendlySchedule): string {
  switch (schedule.frequency) {
    case "hourly":
      return `${schedule.minute} * * * *`;
    case "daily":
      return `${schedule.minute} ${schedule.hour} * * *`;
    case "weekly":
      return `${schedule.minute} ${schedule.hour} * * ${schedule.dayOfWeek}`;
    case "custom":
      return schedule.cron;
  }
}

/** The IANA timezone this browser is configured with, used to seed a newly added schedule. */
export function detectedTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Reconstructs editable trigger state from a pipeline's persisted triggers. */
export function createPipelineTriggerDraft(
  triggers: readonly Trigger[],
  createId: () => string = () => globalThis.crypto.randomUUID(),
): PipelineTriggerDraft {
  const manual = triggers.find((trigger) => trigger.type === "manual");
  const schedules = triggers.filter((trigger) => trigger.type === "schedule").map((trigger) => ({
    cron: trigger.cron,
    enabled: trigger.enabled,
    localId: createId(),
    timezone: trigger.timezone,
  }));

  return { manualEnabled: manual?.enabled ?? false, schedules };
}

/** Adds a new enabled daily schedule defaulted to this browser's timezone. */
export function addPipelineScheduleTrigger(
  draft: PipelineTriggerDraft,
  createId: () => string = () => globalThis.crypto.randomUUID(),
): PipelineTriggerDraft {
  const schedule: PipelineScheduleTriggerDraft = {
    cron: cronFromFriendlySchedule({ frequency: "daily", hour: 0, minute: 0 }),
    enabled: true,
    localId: createId(),
    timezone: detectedTimezone(),
  };
  return { ...draft, schedules: [...draft.schedules, schedule] };
}

/** Removes one Schedule trigger from the draft. */
export function removePipelineScheduleTrigger(draft: PipelineTriggerDraft, localId: string): PipelineTriggerDraft {
  return { ...draft, schedules: draft.schedules.filter((schedule) => schedule.localId !== localId) };
}

/** Replaces one Schedule trigger's editable fields, matched by its draft-local id. */
export function updatePipelineScheduleTrigger(
  draft: PipelineTriggerDraft,
  localId: string,
  changes: Partial<Omit<PipelineScheduleTriggerDraft, "localId">>,
): PipelineTriggerDraft {
  return {
    ...draft,
    schedules: draft.schedules.map((schedule) => (schedule.localId === localId ? { ...schedule, ...changes } : schedule)),
  };
}

/** Sets whether the pipeline's manual "Run Now" trigger is enabled. */
export function setPipelineManualTriggerEnabled(draft: PipelineTriggerDraft, enabled: boolean): PipelineTriggerDraft {
  return { ...draft, manualEnabled: enabled };
}

/** Converts editable trigger state into the canonical write shape accepted by the pipeline update API. */
export function writablePipelineTriggersFromDraft(draft: PipelineTriggerDraft): readonly WritablePipelineTrigger[] {
  return [
    { enabled: draft.manualEnabled, type: "manual" },
    ...draft.schedules.map((schedule) => ({
      cron: schedule.cron,
      enabled: schedule.enabled,
      timezone: schedule.timezone,
      type: "schedule" as const,
    })),
  ];
}
