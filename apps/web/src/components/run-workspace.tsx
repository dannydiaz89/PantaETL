"use client";

import { memo, useCallback, useMemo, useState } from "react";

import { artifactDescriptorSchema, runSchema, type ArtifactDescriptor, type Run, type RunState } from "@pantaetl/contracts";
import { Button, DataTable, type DataTableColumn } from "@pantaetl/ui";

import { useI18n } from "../locale-provider.js";
import type { I18n } from "../locales/index.js";

const firstRunId = "123e4567-e89b-12d3-a456-426614175101";

/** Contract-validated execution history fixtures until the run history API is available. */
function createRunFixtures(): Run[] {
  return [
    parseRun({
      completedAt: "2026-08-13T02:14:22.000Z",
      contractVersion: "v1",
      createdAt: "2026-08-13T02:10:00.000Z",
      id: firstRunId,
      pipelineId: "123e4567-e89b-12d3-a456-426614174101",
      startedAt: "2026-08-13T02:10:04.000Z",
      state: "succeeded",
      steps: [
        runStep("123e4567-e89b-12d3-a456-426614174102", "succeeded", { bytesRead: 2048, durationMilliseconds: 12_000, recordsRead: 240 }),
        runStep("123e4567-e89b-12d3-a456-426614174103", "succeeded", { durationMilliseconds: 8_000, recordsRead: 240, recordsWritten: 240 }),
        runStep("123e4567-e89b-12d3-a456-426614174104", "succeeded", { bytesWritten: 1024, durationMilliseconds: 6_000, recordsWritten: 240 }),
      ],
      warningCount: 0,
    }),
    parseRun({
      contractVersion: "v1",
      createdAt: "2026-08-13T03:00:00.000Z",
      id: "123e4567-e89b-12d3-a456-426614175201",
      pipelineId: "123e4567-e89b-12d3-a456-426614174201",
      startedAt: "2026-08-13T03:00:02.000Z",
      state: "running",
      steps: [
        runStep("123e4567-e89b-12d3-a456-426614174202", "running", { recordsRead: 96 }),
        runStep("123e4567-e89b-12d3-a456-426614174203", "queued", {}),
      ],
      warningCount: 0,
    }),
  ];
}

/** Contract-validated retained file metadata used for the selected successful run. */
function createArtifactFixtures(): ArtifactDescriptor[] {
  return [artifactDescriptorSchema.parse({
    contractVersion: "v1",
    createdAt: "2026-08-13T02:14:22.000Z",
    fileName: "orders-2026-08-13.parquet",
    format: "parquet",
    id: "123e4567-e89b-12d3-a456-426614176101",
    pipelineId: "123e4567-e89b-12d3-a456-426614174101",
    retention: { expiresAt: "2026-09-12T02:14:22.000Z", retentionDays: 30 },
    runId: firstRunId,
    sizeBytes: 1024,
    storage: { encrypted: true, kind: "local", location: "artifacts/orders-2026-08-13.parquet" },
  }) as ArtifactDescriptor];
}

/** Creates safe aggregate run-step data without including record-level payloads. */
function runStep(componentId: string, state: RunState, metrics: Run["steps"][number]["metrics"]): Run["steps"][number] {
  return {
    componentId,
    metrics,
    state,
    stepId: componentId,
    warningCount: 0,
  };
}

/** Validates a run at the browser boundary using the canonical generated contract. */
function parseRun(value: unknown): Run {
  return runSchema.parse(value) as Run;
}

/** Run history workspace with safe metrics and artifact metadata. */
export function RunWorkspace() {
  const { t } = useI18n();
  const [runs] = useState(createRunFixtures);
  const [artifacts] = useState(createArtifactFixtures);
  const [selectedId, setSelectedId] = useState(firstRunId);
  const selectedRun = runs.find((run) => run.id === selectedId) ?? runs[0];
  const selectRun = useCallback((run: Run) => setSelectedId(run.id), []);

  return (
    <section className="run-workspace">
      <div className="run-list">
        <div className="pipeline-section-heading">
          <div><h1>{t("runs.list.title")}</h1><p>{t("runs.list.description")}</p></div>
        </div>
        <RunTable onSelect={selectRun} runs={runs} />
      </div>
      <div className="run-details">
        <div className="pipeline-section-heading">
          <div><h2>{t("runs.details.title")}</h2><p>{t("runs.details.description")}</p></div>
          <RunStateBadge state={selectedRun.state} />
        </div>
        <MetricSummary run={selectedRun} />
        <RunSteps run={selectedRun} />
        <ArtifactMetadata artifacts={artifacts.filter((artifact) => artifact.runId === selectedRun.id)} />
      </div>
    </section>
  );
}

/** Isolates the sortable execution table from selected-run detail state. */
const RunTable = memo(function RunTable({ onSelect, runs }: { readonly onSelect: (run: Run) => void; readonly runs: readonly Run[] }) {
  const { formatDate, formatNumber, t } = useI18n();
  const columns = useMemo<readonly DataTableColumn<Run>[]>(() => [
    { accessorKey: "id", cell: ({ row }) => row.original.id.slice(0, 8), header: t("runs.table.id") },
    { accessorKey: "state", cell: ({ row }) => <RunStateBadge state={row.original.state} />, header: t("runs.table.status") },
    { accessorKey: "pipelineId", cell: ({ row }) => pipelineName(row.original.pipelineId, t), header: t("runs.table.pipeline") },
    { accessorKey: "startedAt", cell: ({ row }) => row.original.startedAt === undefined ? t("runs.metric.notAvailable") : formatDate(row.original.startedAt), header: t("runs.table.started") },
    { cell: ({ row }) => formatDuration(runDuration(row.original), t, formatNumber), header: t("runs.table.duration"), id: "duration" },
    { cell: ({ row }) => <Button onClick={() => onSelect(row.original)} variant="ghost">{t("runs.view")}</Button>, header: t("runs.table.actions"), id: "actions" },
  ], [formatDate, formatNumber, onSelect, t]);

  const sortLabels = useMemo(() => ({
    ascending: () => t("pipeline.sort.ascending"),
    descending: () => t("pipeline.sort.descending"),
    none: () => t("pipeline.sort.none"),
  }), [t]);
  const getColumnLabel = useCallback((column: string) => column === "id" ? t("runs.table.id")
    : column === "state" ? t("runs.table.status")
      : column === "pipelineId" ? t("runs.table.pipeline")
        : column === "startedAt" ? t("runs.table.started")
          : column === "duration" ? t("runs.table.duration")
            : column === "actions" ? t("runs.table.actions")
              : column, [t]);

  return <DataTable
    caption={t("runs.table.caption")}
    columns={columns}
    data={runs}
    emptyState={t("runs.table.empty")}
    getColumnLabel={getColumnLabel}
    loadingState={t("runs.table.loading")}
    sortLabels={sortLabels}
  />;
});

function MetricSummary({ run }: { readonly run: Run }) {
  const { formatNumber, t } = useI18n();
  const metrics = run.steps.reduce((total, step) => ({
    durationMilliseconds: total.durationMilliseconds + (step.metrics.durationMilliseconds ?? 0),
    recordsRead: total.recordsRead + (step.metrics.recordsRead ?? 0),
    recordsWritten: total.recordsWritten + (step.metrics.recordsWritten ?? 0),
  }), { durationMilliseconds: 0, recordsRead: 0, recordsWritten: 0 });

  return <dl className="run-metrics">
    <Metric label={t("runs.metric.recordsRead")} value={formatNumber(metrics.recordsRead)} />
    <Metric label={t("runs.metric.recordsWritten")} value={formatNumber(metrics.recordsWritten)} />
    <Metric label={t("runs.metric.duration")} value={formatDuration(metrics.durationMilliseconds, t, formatNumber)} />
  </dl>;
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function RunSteps({ run }: { readonly run: Run }) {
  const { t } = useI18n();
  const sortLabels = useMemo(() => ({
    ascending: () => t("pipeline.sort.ascending"),
    descending: () => t("pipeline.sort.descending"),
    none: () => t("pipeline.sort.none"),
  }), [t]);
  const columns = useMemo<readonly DataTableColumn<Run["steps"][number]>[]>(() => [
    { accessorKey: "componentId", cell: ({ row }) => componentName(row.original.componentId, t), header: t("runs.steps.component") },
    { accessorKey: "state", cell: ({ row }) => <RunStateBadge state={row.original.state} />, header: t("runs.steps.status") },
    { accessorKey: "warningCount", header: t("runs.steps.warnings") },
  ], [t]);
  const getColumnLabel = useCallback((column: string) => column === "componentId" ? t("runs.steps.component")
    : column === "state" ? t("runs.steps.status")
      : column === "warningCount" ? t("runs.steps.warnings")
        : column, [t]);

  return <section className="run-subsection"><h3>{t("runs.steps.title")}</h3><DataTable
    caption={t("runs.steps.caption")}
    columns={columns}
    data={run.steps}
    emptyState={t("runs.steps.empty")}
    getColumnLabel={getColumnLabel}
    key={run.id}
    loadingState={t("runs.table.loading")}
    sortLabels={sortLabels}
  /></section>;
}

function ArtifactMetadata({ artifacts }: { readonly artifacts: readonly ArtifactDescriptor[] }) {
  const { formatDate, formatNumber, t } = useI18n();
  return <section className="run-subsection"><h3>{t("runs.artifacts.title")}</h3><p>{t("runs.artifacts.description")}</p>{artifacts.length === 0 ? <p>{t("runs.artifacts.none")}</p> : <ul className="artifact-list">{artifacts.map((artifact) => <li key={artifact.id}><strong>{artifact.fileName}</strong><span>{artifact.format}</span><span>{formatNumber(artifact.sizeBytes, { style: "unit", unit: "byte", unitDisplay: "narrow" })}</span><span>{formatDate(artifact.retention.expiresAt)}</span></li>)}</ul>}</section>;
}

function RunStateBadge({ state }: { readonly state: RunState }) {
  const { t } = useI18n();
  return <span className={`run-state run-state--${state}`}>{t(`runs.status.${state}`)}</span>;
}

function pipelineName(id: string, t: I18n["t"]): string {
  return id.endsWith("101") ? t("runs.fixture.daily") : t("runs.fixture.customers");
}

function runDuration(run: Run): number | undefined {
  return run.completedAt === undefined || run.startedAt === undefined ? undefined : new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
}

function formatDuration(milliseconds: number | undefined, t: I18n["t"], formatNumber: I18n["formatNumber"]): string {
  return milliseconds === undefined ? t("runs.metric.notAvailable") : formatNumber(milliseconds / 1_000, { maximumFractionDigits: 1, style: "unit", unit: "second", unitDisplay: "narrow" });
}

/** Maps safe persisted component identifiers to localized display labels in the fixture view. */
function componentName(componentId: string, t: I18n["t"]): string {
  return componentId.endsWith("102") ? t("runs.component.csv")
    : componentId.endsWith("103") ? t("runs.component.normalize")
      : componentId.endsWith("104") ? t("runs.component.postgres")
        : componentId.endsWith("202") ? t("runs.component.api")
          : t("runs.component.parquet");
}
