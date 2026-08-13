# Implementation Guidance

## Existing facts

The database already stores pipeline definitions across:
- pipelines
- pipeline_components
- pipeline_edges
- pipeline_triggers

The canonical Pipeline contract already models:
- state
- steps
- edges
- triggers
- component configuration
- secret bindings

The pipeline domain already enforces:
- only enabled pipelines can run;
- queued/running work locks configuration;
- same-pipeline execution is serialized.

Do not recreate these concepts in parallel models.

## API surface

GET    /api/pipelines
POST   /api/pipelines
GET    /api/pipelines/:pipelineId
PATCH  /api/pipelines/:pipelineId
DELETE /api/pipelines/:pipelineId

POST   /api/pipelines/:pipelineId/duplicate
POST   /api/pipelines/:pipelineId/run
POST   /api/pipelines/:pipelineId/enable
POST   /api/pipelines/:pipelineId/disable

Recommended statuses:
- 200 reads/updates/actions
- 201 create/duplicate
- 204 delete
- 400 invalid input/topology
- 401 unauthenticated
- 403 unauthorized
- 404 not found
- 409 locked/invalid state transition

## Ownership

Repository operations should be explicitly owner-scoped.

Prefer:
getPipeline({ pipelineId, ownerUserId })

Avoid:
getPipeline(id)

unless a clearly named admin-only operation exists.

## Hydration

Create one mapper responsible for:

pipelines + components + edges + triggers -> canonical Pipeline

Routes must not each assemble Pipeline objects independently.

## Writes

Create/update operations touching graph tables must use transactions.

A failed graph update must not leave partial components/edges/triggers.

PATCH may be implemented internally as:
load -> merge -> validate -> atomically replace graph

if that is simpler and safer than diffing.

## Edit lock

Before update/delete/state changes:
- load execution state;
- use shared pipeline-domain rules;
- reject queued/running pipelines.

The frontend may disable controls, but API enforcement is authoritative.

## Delete behavior

Review run foreign keys carefully. Do not accidentally cascade-delete durable run history.

## Secrets

Never return plaintext secrets.

An update that does not replace a secret preserves its binding.
A credential replacement is write-only.
Duplication copies non-secret configuration but not usable credentials.

## Duplication

A duplicate:
- gets a new pipeline identity;
- gets internally consistent new graph identities as required;
- belongs to requesting user;
- starts draft/disabled;
- clears usable secrets;
- resets schedule runtime metadata.

## Run action

POST /run should call existing execution infrastructure rather than implementing scheduling in the route.

## Frontend

Use TanStack Query and a centralized data layer.

Suggested:

apps/web/src/data/pipelines/
  api.ts
  keys.ts
  queries.ts
  mutations.ts

Centralize query keys.

The current pipeline-workspace should be decomposed before significant mutation/error/loading state is added.

Suggested:

components/pipeline/
  pipeline-workspace.tsx
  pipeline-list.tsx
  pipeline-editor.tsx
  pipeline-overview-panel.tsx
  pipeline-source-panel.tsx
  pipeline-transforms-panel.tsx
  pipeline-export-panel.tsx
  pipeline-trigger-panel.tsx
  pipeline-history-panel.tsx
  pipeline-settings-panel.tsx
  pipeline-state-badge.tsx

Do not over-split trivial wrappers.

Do not remove fixtures until real API-backed flows and E2E tests are stable.
