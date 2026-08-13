# Pipeline Builder UX Specification

## Creation flow

Opening **Create pipeline** should launch a dedicated wizard, not a CSV-specific modal.

```text
Create Pipeline
1 Source  →  2 Transforms  →  3 Export
```

Pipeline name is collected in the flow without becoming a fourth numbered step.

## Step 1 — Source

Choose one available Source capability, then render its configuration from `ComponentMetadata.configFields`.

Examples may include CSV, XLSX, JSON, PostgreSQL, REST API, but only installed capabilities are shown.

## Step 2 — Transforms

Transforms are optional. Users can add, configure, remove, and reorder zero or more compatible Transforms. Reordering changes graph order. Keyboard reorder controls are required even if drag-and-drop exists.

## Step 3 — Export

Choose one compatible Export capability and configure it from metadata. No Export type is assumed.

## Draft semantics

The user can save progress before the pipeline is executable. Persist a draft once the canonical contract can represent it; never insert fake placeholder components to satisfy persistence.

A persisted draft can be incomplete. Enabling requires a complete executable pipeline.

## Executable pipeline requirements for this phase

- exactly one Source;
- zero or more Transforms;
- exactly one Export;
- a connected linear chain;
- all component type/version capabilities are available;
- required non-secret config is present;
- required secret bindings are configured;
- adjacent components are data-family compatible;
- no dangling step.

The frontend helps explain readiness, but the backend is authoritative.

## Trigger UX

Trigger remains pipeline-owned and is edited after creation in the pipeline editor. It is not a fourth wizard step. No global Triggers or Schedules navigation.

Common scheduling should use friendly controls; raw cron is an advanced option.

## Existing pipeline editing

Reuse the same Source/Transform/Export editors for idle existing pipelines. Do not build a separate editor system.

## 409 conflict behavior

If a save fails because the pipeline became locked, preserve local unsaved state, explain the lock, and allow reload/retry after the run ends.

## Visual direction

Utility UI: clear hierarchy, borders, whitespace, modest primary accent, text-first component cards, restrained icons. Avoid marketing layout, gradients, excessive cards, emojis, and node-canvas complexity.
