import { describe, expect, it } from "vitest";

import { formatDate, formatNumber, formatRelativeTime, t } from "../src/locales/index.js";

describe("localized control-plane text", () => {
  it("reads visible copy from the English namespace", () => {
    expect(t("overview.title")).toBe("Overview");
  });

  it("formats dates, numbers, and relative time through the configured locale", () => {
    expect(formatDate("2026-08-13T00:00:00.000Z", { timeZone: "UTC" })).toContain("2026");
    expect(formatNumber(12345)).toContain("12");
    expect(formatRelativeTime(-1, "day")).not.toBe("");
  });
});
