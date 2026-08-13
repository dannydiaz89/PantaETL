import { describe, expect, it } from "vitest";

import { createI18n, DEFAULT_LOCALE, resolveLocale } from "../src/locales/index.js";

describe("localized control-plane text", () => {
  it("reads visible copy from the English namespace", () => {
    expect(createI18n(DEFAULT_LOCALE).t("overview.title")).toBe("Overview");
  });

  it("formats dates, numbers, and relative time through the configured locale", () => {
    const i18n = createI18n(DEFAULT_LOCALE);

    expect(i18n.formatDate("2026-08-13T00:00:00.000Z", { timeZone: "UTC" })).toContain("2026");
    expect(i18n.formatNumber(12345)).toContain("12");
    expect(i18n.formatRelativeTime(-1, "day")).not.toBe("");
    expect(i18n.formatPlural(2, { one: "# pipeline", other: "# pipelines" })).toBe("2 pipelines");
  });

  it("resolves unsupported browser preferences to the configured default locale", () => {
    expect(resolveLocale("en")).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("en-GB")).toBe("en-GB");
    expect(resolveLocale("unsupported-Locale")).toBe(DEFAULT_LOCALE);
  });
});
