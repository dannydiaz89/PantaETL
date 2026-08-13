import { CircleAlert } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Icon, cx } from "../src/index.js";

describe("design-system foundation", () => {
  it("combines optional utility classes predictably", () => {
    expect(cx("button", false, undefined, "button-primary")).toBe("button button-primary");
  });

  it("hides decorative icons from assistive technology", () => {
    const markup = renderToStaticMarkup(<Icon icon={CircleAlert} />);

    expect(markup).toContain('aria-hidden="true"');
  });

  it("names standalone informative icons", () => {
    const markup = renderToStaticMarkup(<Icon icon={CircleAlert} label="Warning" />);

    expect(markup).toContain('role="img"');
    expect(markup).toContain('aria-label="Warning"');
  });
});
