import { createFileRoute } from "@tanstack/react-router";
import SwaggerUI from "swagger-ui-react";

import "swagger-ui-react/swagger-ui.css";

/** Renders interactive documentation for the generated OpenAPI document. */
export const Route = createFileRoute("/api/docs")({
  component: ApiDocumentation,
  ssr: false,
});

function ApiDocumentation() {
  return <SwaggerUI url="/api/openapi.json" />;
}
