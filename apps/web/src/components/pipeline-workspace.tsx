"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";

import type { Pipeline, PipelineState, PipelineStep, Trigger } from "@pantaetl/contracts";
import { enqueuePipelineRun, isPipelineEditable } from "@pantaetl/pipeline";
import {
  Button,
  DataTable,
  Field,
  Input,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type DataTableColumn,
} from "@pantaetl/ui";

import { getPipelineExecutionState, parsePipeline } from "../lib/pipeline-boundary.js";
import { useI18n } from "../locale-provider.js";
import type { I18n } from "../locales/index.js";

const lockedPipelineId = "123e4567-e89b-12d3-a456-426614174101";
const ownerUserId = "123e4567-e89b-12d3-a456-426614174001";

/** Contract-validated fixture data until the control-plane pipeline API is available. */
function createPipelineFixtures(t: I18n["t"]): Pipeline[] {
  return [
    parsePipeline({
      contractVersion: "v1",
      createdAt: "2026-08-13T00:00:00.000Z",
      edges: [
        { fromStepId: "123e4567-e89b-12d3-a456-426614174102", toStepId: "123e4567-e89b-12d3-a456-426614174103" },
        { fromStepId: "123e4567-e89b-12d3-a456-426614174103", toStepId: "123e4567-e89b-12d3-a456-426614174104" },
      ],
      id: lockedPipelineId,
      name: t("pipeline.fixture.daily"),
      ownerUserId,
      state: "enabled",
      steps: [
        step("123e4567-e89b-12d3-a456-426614174102", "source", "csv-source", { path: "/imports/orders.csv" }),
        step("123e4567-e89b-12d3-a456-426614174103", "transform", "normalize-orders", { format: "iso-date" }),
        step("123e4567-e89b-12d3-a456-426614174104", "export", "postgres-export", { table: "orders" }),
      ],
      triggers: [{
        cron: "0 2 * * *",
        enabled: true,
        id: "123e4567-e89b-12d3-a456-426614174105",
        pipelineId: lockedPipelineId,
        timezone: "UTC",
        type: "schedule",
      }],
      updatedAt: "2026-08-13T00:00:00.000Z",
    }),
    parsePipeline({
      contractVersion: "v1",
      createdAt: "2026-08-12T00:00:00.000Z",
      edges: [{ fromStepId: "123e4567-e89b-12d3-a456-426614174202", toStepId: "123e4567-e89b-12d3-a456-426614174203" }],
      id: "123e4567-e89b-12d3-a456-426614174201",
      name: t("pipeline.fixture.customers"),
      ownerUserId,
      state: "draft",
      steps: [
        step("123e4567-e89b-12d3-a456-426614174202", "source", "api-source", { endpoint: "customers" }),
        step("123e4567-e89b-12d3-a456-426614174203", "export", "parquet-export", { location: "customers" }),
      ],
      triggers: [{
        enabled: true,
        id: "123e4567-e89b-12d3-a456-426614174204",
        pipelineId: "123e4567-e89b-12d3-a456-426614174201",
        type: "manual",
      }],
      updatedAt: "2026-08-12T00:00:00.000Z",
    }),
  ];
}

/** Creates one graph component without including secret values in browser fixture data. */
function step(id: string, kind: PipelineStep["kind"], componentType: string, values: Record<string, string>): PipelineStep {
  return {
    componentType,
    componentVersion: "v1",
    configuration: { secretBindings: [], values },
    id,
    kind,
  };
}

/** Form-led pipeline list and editor that reflects the shared execution lock invariant. */
export function PipelineWorkspace() {
  const { t } = useI18n();
  const [pipelines, setPipelines] = useState(() => createPipelineFixtures(t));
  const [selectedId, setSelectedId] = useState(lockedPipelineId);
  const [hydrated, setHydrated] = useState(false);
  const selectedPipeline = pipelines.find((pipeline) => pipeline.id === selectedId) ?? pipelines[0];
  const selectedState = executionState(selectedPipeline);
  const editable = isPipelineEditable(selectedState);
  const [draftName, setDraftName] = useState(selectedPipeline.name);
  const [saved, setSaved] = useState(false);

  useEffect(() => setHydrated(true), []);

  const selectPipeline = useCallback((pipeline: Pipeline) => {
    setSelectedId(pipeline.id);
    setDraftName(pipeline.name);
    setSaved(false);
  }, []);

  function savePipeline() {
    if (!editable) {
      return;
    }

    setPipelines((current) => current.map((pipeline) => (
      pipeline.id === selectedPipeline.id ? { ...pipeline, name: draftName, updatedAt: new Date().toISOString() } : pipeline
    )));
    setSaved(true);
  }

  return (
    <section className="pipeline-workspace" data-hydrated={hydrated ? "true" : "false"}>
      <div className="pipeline-list">
        <div className="pipeline-section-heading">
          <div>
            <h1>{t("pipeline.list.title")}</h1>
            <p>{t("pipeline.list.description")}</p>
          </div>
        </div>
        <PipelineTable onSelect={selectPipeline} pipelines={pipelines} />
      </div>
      <form className="pipeline-editor" onSubmit={(event) => { event.preventDefault(); savePipeline(); }}>
        <div className="pipeline-section-heading">
          <div>
            <h2>{t("pipeline.editor.title")}</h2>
            <p>{t("pipeline.editor.description")}</p>
          </div>
          <PipelineStateBadge state={selectedPipeline.state} />
        </div>
        {!editable ? (
          <div className="pipeline-lock-notice" role="status">
            <strong>{t("pipeline.locked.title")}</strong>
            <p>{t("pipeline.locked.description")}</p>
          </div>
        ) : null}
        <Tabs defaultValue="overview">
          <TabsList aria-label={t("pipeline.editor.title")}>
            <TabsTrigger value="overview">{t("pipeline.tab.overview")}</TabsTrigger>
            <TabsTrigger value="source">{t("pipeline.tab.source")}</TabsTrigger>
            <TabsTrigger value="transforms">{t("pipeline.tab.transforms")}</TabsTrigger>
            <TabsTrigger value="export">{t("pipeline.tab.export")}</TabsTrigger>
            <TabsTrigger value="trigger">{t("pipeline.tab.trigger")}</TabsTrigger>
            <TabsTrigger value="history">{t("pipeline.tab.history")}</TabsTrigger>
            <TabsTrigger value="settings">{t("pipeline.tab.settings")}</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <div className="pipeline-tab-panel">
              <Field description={t("pipeline.nameDescription")} label={t("pipeline.name")} required>
                {({ describedBy, id, invalid }) => <Input aria-describedby={describedBy} aria-invalid={invalid} disabled={!editable} id={id} onChange={(event) => setDraftName(event.target.value)} required value={draftName} />}
              </Field>
              <Button disabled={!editable} type="submit">{t("pipeline.save")}</Button>
              {saved ? <p className="pipeline-save-status" role="status">{t("pipeline.saveSuccess")}</p> : null}
            </div>
          </TabsContent>
          <TabsContent value="source"><PipelineStepSection description={t("pipeline.source.description")} kind="source" pipeline={selectedPipeline} /></TabsContent>
          <TabsContent value="transforms"><PipelineStepSection description={t("pipeline.transforms.description")} kind="transform" pipeline={selectedPipeline} /></TabsContent>
          <TabsContent value="export"><PipelineStepSection description={t("pipeline.export.description")} kind="export" pipeline={selectedPipeline} /></TabsContent>
          <TabsContent value="trigger"><TriggerSection triggers={selectedPipeline.triggers} /></TabsContent>
          <TabsContent value="history"><HistorySection editable={editable} /></TabsContent>
          <TabsContent value="settings"><SettingsSection editable={editable} state={selectedPipeline.state} /></TabsContent>
        </Tabs>
      </form>
    </section>
  );
}

/** Isolates the performant table from form-only editor state changes. */
const PipelineTable = memo(function PipelineTable({ onSelect, pipelines }: { readonly onSelect: (pipeline: Pipeline) => void; readonly pipelines: readonly Pipeline[] }) {
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

  return <DataTable
    caption={t("pipeline.table.caption")}
    columns={columns}
    data={pipelines}
    emptyState={t("pipeline.table.empty")}
    getColumnLabel={getColumnLabel}
    loadingState={t("pipeline.table.loading")}
    sortLabels={sortLabels}
  />;
});

/** Reflects the active-run lock using the shared execution domain, not a UI-specific flag. */
function executionState(pipeline: Pipeline) {
  const state = getPipelineExecutionState(pipeline);
  return pipeline.id === lockedPipelineId ? enqueuePipelineRun(state, "123e4567-e89b-12d3-a456-426614174106") : state;
}

function PipelineStepSection({ description, kind, pipeline }: { readonly description: string; readonly kind: PipelineStep["kind"]; readonly pipeline: Pipeline }) {
  const { t } = useI18n();
  const steps = pipeline.steps.filter((step) => step.kind === kind);

  return (
    <div className="pipeline-tab-panel">
      <p>{description}</p>
      {steps.length === 0 ? <p>{t("pipeline.components.empty")}</p> : (
        <ul className="pipeline-component-list">
          {steps.map((step) => <li key={step.id}><strong>{step.componentType}</strong><span>{t("pipeline.components.version")}: {step.componentVersion}</span></li>)}
        </ul>
      )}
    </div>
  );
}

function TriggerSection({ triggers }: { readonly triggers: readonly Trigger[] }) {
  const { t } = useI18n();
  return (
    <div className="pipeline-tab-panel">
      <p>{t("pipeline.trigger.description")}</p>
      {triggers.length === 0 ? <p>{t("pipeline.trigger.none")}</p> : triggers.map((trigger) => (
        <dl className="pipeline-trigger" key={trigger.id}>
          <dt>{trigger.type === "manual" ? t("pipeline.trigger.manual") : t("pipeline.trigger.schedule")}</dt>
          <dd>{trigger.enabled ? t("pipeline.state.enabled") : t("pipeline.state.disabled")}</dd>
          {trigger.type === "schedule" ? <><dt>{t("pipeline.trigger.cron")}</dt><dd>{trigger.cron}</dd><dt>{t("pipeline.trigger.timezone")}</dt><dd>{trigger.timezone}</dd></> : null}
        </dl>
      ))}
    </div>
  );
}

function HistorySection({ editable }: { readonly editable: boolean }) {
  const { t } = useI18n();
  return <div className="pipeline-tab-panel"><p>{t("pipeline.history.description")}</p><p><strong>{t("pipeline.history.active")}:</strong> {editable ? t("pipeline.history.none") : t("pipeline.locked.title")}</p></div>;
}

function SettingsSection({ editable, state }: { readonly editable: boolean; readonly state: PipelineState }) {
  const { t } = useI18n();
  const stateOptions = useMemo(() => [
    { label: t("pipeline.state.draft"), value: "draft" },
    { label: t("pipeline.state.enabled"), value: "enabled" },
    { label: t("pipeline.state.disabled"), value: "disabled" },
  ] as const, [t]);
  return (
    <div className="pipeline-tab-panel">
      <p>{t("pipeline.settings.description")}</p>
      <Field label={t("pipeline.state")}>
        {({ describedBy, id, invalid }) => <Select aria-describedby={describedBy} aria-invalid={invalid} disabled={!editable} id={id} options={stateOptions} placeholder={t("pipeline.statePlaceholder")} value={state} />}
      </Field>
    </div>
  );
}

function PipelineStateBadge({ state }: { readonly state: PipelineState }) {
  const { t } = useI18n();
  return <span className={`pipeline-state pipeline-state--${state}`}>{t(`pipeline.state.${state}`)}</span>;
}
