import type { Trigger } from "@pantaetl/contracts";
import { describe, expect, it } from "vitest";

import {
  addPipelineScheduleTrigger,
  createPipelineTriggerDraft,
  cronFromFriendlySchedule,
  friendlyScheduleFromCron,
  removePipelineScheduleTrigger,
  setPipelineManualTriggerEnabled,
  updatePipelineScheduleTrigger,
  writablePipelineTriggersFromDraft,
} from "../src/components/pipeline/pipeline-trigger-draft.js";

describe("friendlyScheduleFromCron / cronFromFriendlySchedule", () => {
  it("round-trips an hourly schedule", () => {
    expect(friendlyScheduleFromCron("15 * * * *")).toEqual({ frequency: "hourly", minute: 15 });
    expect(cronFromFriendlySchedule({ frequency: "hourly", minute: 15 })).toBe("15 * * * *");
  });

  it("round-trips a daily schedule", () => {
    expect(friendlyScheduleFromCron("30 9 * * *")).toEqual({ frequency: "daily", hour: 9, minute: 30 });
    expect(cronFromFriendlySchedule({ frequency: "daily", hour: 9, minute: 30 })).toBe("30 9 * * *");
  });

  it("round-trips a weekly schedule", () => {
    expect(friendlyScheduleFromCron("0 8 * * 1")).toEqual({ frequency: "weekly", dayOfWeek: 1, hour: 8, minute: 0 });
    expect(cronFromFriendlySchedule({ frequency: "weekly", dayOfWeek: 1, hour: 8, minute: 0 })).toBe("0 8 * * 1");
  });

  it("falls back to custom for a cron expression matching no common shape", () => {
    expect(friendlyScheduleFromCron("*/15 * * * *")).toEqual({ frequency: "custom", cron: "*/15 * * * *" });
    expect(cronFromFriendlySchedule({ frequency: "custom", cron: "*/15 * * * *" })).toBe("*/15 * * * *");
  });
});

describe("pipeline trigger draft", () => {
  it("reconstructs manual and schedule state from persisted triggers, assigning fresh local ids", () => {
    const triggers: readonly Trigger[] = [
      { enabled: true, id: "t1", pipelineId: "p1", type: "manual" },
      { cron: "0 9 * * *", enabled: true, id: "t2", pipelineId: "p1", timezone: "UTC", type: "schedule" },
    ];

    const draft = createPipelineTriggerDraft(triggers, () => "local-1");

    expect(draft.manualEnabled).toBe(true);
    expect(draft.schedules).toEqual([{ cron: "0 9 * * *", enabled: true, localId: "local-1", timezone: "UTC" }]);
  });

  it("defaults the manual trigger to disabled when the pipeline has none yet", () => {
    const draft = createPipelineTriggerDraft([]);

    expect(draft.manualEnabled).toBe(false);
    expect(draft.schedules).toEqual([]);
  });

  it("adds a new enabled daily schedule with a fresh local id", () => {
    const draft = addPipelineScheduleTrigger(createPipelineTriggerDraft([]), () => "local-2");

    expect(draft.schedules).toEqual([{ cron: "0 0 * * *", enabled: true, localId: "local-2", timezone: expect.any(String) }]);
  });

  it("removes a schedule by its local id without touching others", () => {
    let draft = createPipelineTriggerDraft([]);
    draft = addPipelineScheduleTrigger(draft, () => "local-1");
    draft = addPipelineScheduleTrigger(draft, () => "local-2");

    draft = removePipelineScheduleTrigger(draft, "local-1");

    expect(draft.schedules.map((schedule) => schedule.localId)).toEqual(["local-2"]);
  });

  it("updates one schedule's fields by local id", () => {
    let draft = createPipelineTriggerDraft([]);
    draft = addPipelineScheduleTrigger(draft, () => "local-1");

    draft = updatePipelineScheduleTrigger(draft, "local-1", { cron: "0 8 * * 1", timezone: "America/New_York" });

    expect(draft.schedules[0]).toMatchObject({ cron: "0 8 * * 1", timezone: "America/New_York" });
  });

  it("toggles the manual trigger", () => {
    const draft = setPipelineManualTriggerEnabled(createPipelineTriggerDraft([]), true);

    expect(draft.manualEnabled).toBe(true);
  });

  it("converts draft state into the canonical write shape, omitting local-only identity", () => {
    let draft = createPipelineTriggerDraft([]);
    draft = setPipelineManualTriggerEnabled(draft, true);
    draft = addPipelineScheduleTrigger(draft, () => "local-1");
    draft = updatePipelineScheduleTrigger(draft, "local-1", { cron: "0 8 * * 1", enabled: false, timezone: "UTC" });

    expect(writablePipelineTriggersFromDraft(draft)).toEqual([
      { enabled: true, type: "manual" },
      { cron: "0 8 * * 1", enabled: false, timezone: "UTC", type: "schedule" },
    ]);
  });
});
