import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ThemeProvider } from "../src/theme-provider.js";

describe("ThemeProvider", () => {
  it("provides a hydration-safe theme boundary", () => {
    expect(renderToStaticMarkup(<ThemeProvider><div>content</div></ThemeProvider>)).toContain("content");
  });
});
