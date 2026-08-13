import { describe, expect, it } from "vitest";

import { calculateNextScheduleRun } from "../src/schedule-claims.js";

describe("calculateNextScheduleRun", () => {
  it("advances from the prior occurrence so missed schedules remain queued", () => {
    const scheduledFor = new Date("2026-08-13T08:00:00.000Z");

    expect(calculateNextScheduleRun("0 * * * *", "UTC", scheduledFor)).toEqual(
      new Date("2026-08-13T09:00:00.000Z"),
    );
  });

  it("calculates cron occurrences in the trigger's configured timezone", () => {
    const beforeLocalMorning = new Date("2026-01-15T12:00:00.000Z");

    expect(calculateNextScheduleRun("0 8 * * *", "America/Los_Angeles", beforeLocalMorning)).toEqual(
      new Date("2026-01-15T16:00:00.000Z"),
    );
  });

  it("rejects invalid cron expressions and timezones before a claim can advance", () => {
    expect(() => calculateNextScheduleRun("not cron", "UTC", new Date())).toThrow();
    expect(() => calculateNextScheduleRun("0 * * * *", "not/a-timezone", new Date())).toThrow();
  });
});
