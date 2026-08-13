import { renderToStaticMarkup } from "react-dom/server";
import type { ColumnDef } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";

import { DataTable } from "../src/index.js";

interface PipelineRow { readonly name: string; readonly state: string; }

const columns: readonly ColumnDef<PipelineRow, unknown>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "state", header: "State" },
];

const sortLabels = {
  ascending: (column: string) => `Sort ${column} ascending`,
  descending: (column: string) => `Sort ${column} descending`,
  none: (column: string) => `Clear ${column} sorting`,
};

describe("DataTable", () => {
  it("uses semantic table markup and localized sort labels", () => {
    const markup = renderToStaticMarkup(
      <DataTable
        caption="Pipelines"
        columns={columns}
        data={[{ name: "daily-orders", state: "enabled" }]}
        emptyState="No pipelines"
        getColumnLabel={(column) => column}
        loadingState="Loading pipelines"
        sortLabels={sortLabels}
      />,
    );

    expect(markup).toContain("<table");
    expect(markup).toContain('aria-label="Sort name ascending"');
    expect(markup).toContain('aria-sort="none"');
  });

  it("renders caller-provided loading and empty states", () => {
    const loading = renderToStaticMarkup(
      <DataTable caption="Pipelines" columns={columns} data={[]} emptyState="No pipelines" getColumnLabel={(column) => column} isLoading loadingState="Loading pipelines" sortLabels={sortLabels} />,
    );
    const empty = renderToStaticMarkup(
      <DataTable caption="Pipelines" columns={columns} data={[]} emptyState="No pipelines" getColumnLabel={(column) => column} loadingState="Loading pipelines" sortLabels={sortLabels} />,
    );

    expect(loading).toContain("Loading pipelines");
    expect(empty).toContain("No pipelines");
  });
});
