import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Sidebar } from "../src/index.js";

describe("Sidebar", () => {
  it("exposes its collapsed state and structured navigation regions", () => {
    const markup = renderToStaticMarkup(
      <Sidebar
        aria-label="Main navigation"
        collapsed
        footer={<button type="button">Account</button>}
        header={<a href="/">PantaETL</a>}
        navigation={<nav>Navigation</nav>}
      />,
    );

    expect(markup).toContain('<aside class="ui-sidebar" data-collapsed="true" aria-label="Main navigation">');
    expect(markup).toContain('class="ui-sidebar__navigation"');
    expect(markup).toContain('class="ui-sidebar__footer"');
  });
});
