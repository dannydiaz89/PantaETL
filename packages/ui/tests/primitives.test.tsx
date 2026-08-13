import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button, Checkbox, Field, Input, Tabs, TabsContent, TabsList, TabsTrigger } from "../src/index.js";

describe("accessible UI primitives", () => {
  it("connects a field label and error to its native input", () => {
    const markup = renderToStaticMarkup(
      <Field error="A value is required" label="Pipeline name" required>
        {({ describedBy, id, invalid }) => (
          <Input aria-describedby={describedBy} aria-invalid={invalid} id={id} />
        )}
      </Field>,
    );

    expect(markup).toContain("for=");
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('aria-invalid="true"');
  });

  it("uses semantic native controls and Radix keyboard semantics", () => {
    const markup = renderToStaticMarkup(
      <>
        <Button>Save</Button>
        <Checkbox label="Enable pipeline" />
        <Tabs defaultValue="overview">
          <TabsList aria-label="Pipeline sections">
            <TabsTrigger value="overview">Overview</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">Content</TabsContent>
        </Tabs>
      </>,
    );

    expect(markup).toContain('type="button"');
    expect(markup).toContain('role="checkbox"');
    expect(markup).toContain('role="tablist"');
  });
});
