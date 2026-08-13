import { describe, expect, it } from "vitest";

import { navigationItems } from "../src/components/app-shell.js";

describe("application navigation", () => {
  it("keeps the supported product destinations as native link targets", () => {
    expect(navigationItems.map((item) => item.to)).toEqual([
      "/",
      "/pipelines",
      "/runs",
      "/plugins",
      "/system",
      "/users",
    ]);
  });

  it("does not surface global connection or schedule destinations", () => {
    expect(navigationItems.map((item) => item.key)).not.toContain("navigation.connections");
    expect(navigationItems.map((item) => item.key)).not.toContain("navigation.schedules");
  });
});
