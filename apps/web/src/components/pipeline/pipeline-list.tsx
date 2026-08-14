import { memo, useCallback, useMemo } from "react";

import { Link } from "@tanstack/react-router";
import type { Pipeline } from "@pantaetl/contracts";
import { Button, DataTable, type DataTableColumn } from "@pantaetl/ui";

import { useI18n } from "../../locale-provider.js";
import { PipelineStateBadge } from "./pipeline-state-badge.js";

/** Renders the selectable pipeline library without coupling it to editor state. */
export const PipelineList = memo(function PipelineList({
  isError,
  isLoading,
  isRetrying,
  onRetry,
  onSelect,
  pipelines,
}: {
  readonly isError: boolean;
  readonly isLoading: boolean;
  readonly isRetrying: boolean;
  readonly onRetry: () => void;
  readonly onSelect: (pipeline: Pipeline) => void;
  readonly pipelines: readonly Pipeline[];
}) {
  const { t } = useI18n();
  const columns = useMemo<readonly DataTableColumn<Pipeline>[]>(() => [
    { accessorKey: "name", header: t("pipeline.table.name") },
    {
      accessorKey: "state",
      cell: ({ row }) => <PipelineStateBadge state={row.original.state} />,
      header: t("pipeline.table.state"),
    },
    {
      cell: ({ row }) => row.original.steps.length,
      header: t("pipeline.table.steps"),
      id: "steps",
    },
    {
      cell: ({ row }) => (
        <Button onClick={() => onSelect(row.original)} variant="ghost">
          {t("pipeline.open")}
        </Button>
      ),
      header: t("pipeline.table.actions"),
      id: "actions",
    },
  ], [onSelect, t]);
  const sortLabels = useMemo(() => ({
    ascending: () => t("pipeline.sort.ascending"),
    descending: () => t("pipeline.sort.descending"),
    none: () => t("pipeline.sort.none"),
  }), [t]);
  const getColumnLabel = useCallback((column: string) => column === "name" ? t("pipeline.table.name")
    : column === "state" ? t("pipeline.table.state")
      : column === "steps" ? t("pipeline.table.steps")
        : column === "actions" ? t("pipeline.table.actions")
          : column, [t]);

  return (
    <div className="pipeline-list">
      <div className="pipeline-section-heading">
        <div>
          <h1>{t("pipeline.list.title")}</h1>
          <p>{t("pipeline.list.description")}</p>
        </div>
        {pipelines.length > 0 || isLoading || isError ? (
          <Button asChild>
            <Link to="/pipelines/new">{t("pipeline.create.open")}</Link>
          </Button>
        ) : null}
      </div>
      {isError ? (
        <div aria-live="assertive" className="pipeline-query-state" role="alert">
          <p>{t("pipeline.table.error")}</p>
          <Button disabled={isRetrying} onClick={onRetry} variant="secondary">{t("pipeline.retry")}</Button>
        </div>
      ) : (
        <DataTable
          caption={t("pipeline.table.caption")}
          columns={columns}
          data={pipelines}
          emptyState={<PipelineEmptyState />}
          getColumnLabel={getColumnLabel}
          isLoading={isLoading}
          loadingState={t("pipeline.table.loading")}
          sortLabels={sortLabels}
        />
      )}
    </div>
  );
});

/** Gives an empty library a clear next step without relying on the toolbar action. */
function PipelineEmptyState() {
  const { t } = useI18n();

  return (
    <div className="pipeline-empty-state">
      <p>{t("pipeline.table.empty")}</p>
      <p>{t("pipeline.table.emptyDescription")}</p>
      <Button asChild>
        <Link to="/pipelines/new">{t("pipeline.create.open")}</Link>
      </Button>
    </div>
  );
}
