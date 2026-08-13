# PantaETL Roadmap

This file is the authoritative project dashboard.

Detailed implementation scope and acceptance criteria live in `docs/tasks/`.

The roadmap is intentionally ordered to:

1. establish repository tooling;
2. scaffold the complete application topology;
3. establish shared contracts;
4. fan out into parallel frontend and backend workstreams.

This allows multiple agents to work concurrently without waiting for one side of the product to be substantially implemented first.

## Status values

- `READY` — dependencies are complete and work may begin.
- `IN PROGRESS` — actively owned and being implemented.
- `COMPLETE` — all required acceptance criteria pass.
- `BLOCKED` — work cannot proceed; blocker is recorded in the task file.
- `DEFERRED` — intentionally postponed.

## Agent rules

Before starting a task:

1. open its task file;
2. verify dependencies;
3. mark task and roadmap row IN PROGRESS;
4. record owner if available.

When complete:

1. satisfy all acceptance criteria;
2. mark task and roadmap row COMPLETE.

Do not use task IDs in implementation comments or commit messages.

## Dependency shape

```text
Repository Foundation
        |
        v
Application Skeleton
        |
        v
Shared Contracts
        |
        +-----------------------------+
        |                             |
        v                             v
Frontend Track                  Backend Track
Design System                   Database
Web Shell                       Scheduler
Auth/UI                         Worker
Pipeline UI                     Garbage Collector
        |                             |
        +--------------+--------------+
                       |
                       v
               Integrated Features
             Sources / Transforms
              Exports / API / Ops
```

The application skeleton comes before contracts so every service/package boundary exists before the shared interfaces are finalized.

## Milestone 1 — Repository Foundation

| ID | Work Item | Workstream | Status | Depends On | Owner |
|---|---|---|---|---|---|
| FOUNDATION-001 | Repository scaffolding | Foundation | COMPLETE | — | Codex |
| FOUNDATION-002 | TypeScript quality baseline | Foundation | COMPLETE | FOUNDATION-001 | Codex |
| FOUNDATION-003 | Python uv quality baseline | Foundation | COMPLETE | FOUNDATION-001 | Codex |
| FOUNDATION-004 | GitHub Actions baseline | Foundation | BLOCKED | FOUNDATION-002, FOUNDATION-003 | Unassigned |

## Milestone 2 — Complete Application Skeleton

These tasks establish the real service/package topology before detailed contracts or features are implemented.

| ID | Work Item | Workstream | Status | Depends On | Owner |
|---|---|---|---|---|---|
| APP-001 | Monorepo application topology | Application Setup | BLOCKED | FOUNDATION-002, FOUNDATION-003 | Unassigned |
| APP-002 | TanStack Start web scaffold | Application Setup | BLOCKED | APP-001 | Unassigned |
| APP-003 | TypeScript service scaffolds | Application Setup | BLOCKED | APP-001 | Unassigned |
| APP-004 | Python worker application scaffold | Application Setup | BLOCKED | APP-001 | Unassigned |
| APP-005 | Package boundary scaffolds | Application Setup | BLOCKED | APP-001 | Unassigned |
| APP-006 | Docker Compose development topology | Application Setup | BLOCKED | APP-002, APP-003, APP-004 | Unassigned |
| APP-007 | Application skeleton CI validation | Application Setup | BLOCKED | APP-005, APP-006, FOUNDATION-004 | Unassigned |

Milestone 2 is complete when every planned core service and shared package exists, starts/builds at a skeleton level, and its ownership boundary is visible in the repository.

No ETL feature implementation belongs in this milestone.

## Milestone 3 — Shared Contracts and Domain Boundaries

Contracts are established only after all runtime/package boundaries exist.

| ID | Work Item | Workstream | Status | Depends On | Owner |
|---|---|---|---|---|---|
| CONTRACT-001 | Contracts package foundation | Contracts | BLOCKED | APP-005 | Unassigned |
| CONTRACT-002 | Core identifier contracts | Contracts | BLOCKED | CONTRACT-001 | Unassigned |
| CONTRACT-003 | Component configuration contracts | Contracts | BLOCKED | CONTRACT-002 | Unassigned |
| CONTRACT-004 | Dataset and artifact contracts | Contracts | BLOCKED | CONTRACT-002 | Unassigned |
| CONTRACT-005 | Job and run contracts | Contracts | BLOCKED | CONTRACT-002 | Unassigned |
| CONTRACT-006 | Pipeline and trigger contracts | Contracts | BLOCKED | CONTRACT-002, CONTRACT-003 | Unassigned |
| CONTRACT-007 | JSON Schema generation | Contracts | BLOCKED | CONTRACT-003, CONTRACT-004, CONTRACT-005, CONTRACT-006 | Unassigned |
| CONTRACT-008 | Pydantic interoperability proof | Contracts | BLOCKED | CONTRACT-007, APP-004 | Unassigned |
| PIPELINE-001 | Pipeline domain foundation | Pipeline Domain | BLOCKED | CONTRACT-006, APP-005 | Unassigned |
| PIPELINE-002 | Pipeline state machine | Pipeline Domain | BLOCKED | PIPELINE-001 | Unassigned |
| PIPELINE-003 | Component compatibility rules | Pipeline Domain | BLOCKED | PIPELINE-001, CONTRACT-004 | Unassigned |
| PIPELINE-004 | Duplication and import/export rules | Pipeline Domain | BLOCKED | PIPELINE-002, PIPELINE-003 | Unassigned |

## Parallelization Gate

When the following are COMPLETE:

- APP-007
- CONTRACT-008
- PIPELINE-002
- PIPELINE-003

the project deliberately splits into concurrent tracks.

An agent can work on the frontend while separate agents work on database, scheduler, worker, and retention services.

## Track A — Frontend and Control-Plane UI

| ID | Work Item | Workstream | Status | Depends On | Owner |
|---|---|---|---|---|---|
| UI-001 | Design-system implementation foundation | Design System | BLOCKED | APP-005, CONTRACT-003 | Unassigned |
| UI-002 | Theme and token foundation | Design System | BLOCKED | UI-001 | Unassigned |
| UI-003 | Accessible primitive foundation | Design System | BLOCKED | UI-002 | Unassigned |
| UI-004 | Data table foundation | Design System | BLOCKED | UI-003 | Unassigned |
| UI-005 | Accessibility test baseline | Design System | BLOCKED | UI-003, APP-007 | Unassigned |
| WEB-001 | Web control-plane foundation | Web | BLOCKED | APP-002, CONTRACT-006, PIPELINE-002 | Unassigned |
| WEB-002 | Localization and theme integration | Web | BLOCKED | WEB-001, UI-002 | Unassigned |
| WEB-003 | Authentication foundation | Web | BLOCKED | WEB-001, DB-002 | Unassigned |
| WEB-004 | First-admin and password-reset flows | Web | BLOCKED | WEB-003 | Unassigned |
| WEB-005 | Application navigation shell | Web | BLOCKED | WEB-002, UI-003 | Unassigned |
| WEB-006 | Pipeline list/editor foundation | Web | BLOCKED | WEB-005, PIPELINE-003 | Unassigned |
| WEB-007 | Runs and history UI foundation | Web | BLOCKED | WEB-005, CONTRACT-005 | Unassigned |
| WEB-008 | System and settings UI foundation | Web | BLOCKED | WEB-005, OBS-002 | Unassigned |

## Track B — Database and Control-Plane Backend

| ID | Work Item | Workstream | Status | Depends On | Owner |
|---|---|---|---|---|---|
| DB-001 | Database implementation foundation | Database | BLOCKED | APP-005, CONTRACT-002 | Unassigned |
| DB-002 | Core control-plane schema | Database | BLOCKED | DB-001, CONTRACT-004, CONTRACT-005, CONTRACT-006 | Unassigned |
| DB-003 | Job queue schema and indexes | Database | BLOCKED | DB-002 | Unassigned |
| DB-004 | Checkpoint and retention schema | Database | BLOCKED | DB-002 | Unassigned |
| DB-005 | Secret storage model | Database | BLOCKED | DB-002, CONTRACT-003 | Unassigned |
| DB-006 | Migration validation baseline | Database | BLOCKED | DB-002, APP-007 | Unassigned |
| SCHED-001 | Scheduler runtime foundation | Scheduler | BLOCKED | APP-003, DB-003, PIPELINE-002 | Unassigned |
| SCHED-002 | Due-schedule claiming | Scheduler | BLOCKED | SCHED-001 | Unassigned |
| SCHED-003 | Run/job creation and same-pipeline queueing | Scheduler | BLOCKED | SCHED-002, CONTRACT-005 | Unassigned |
| GC-001 | Garbage-collector runtime foundation | Garbage Collector | BLOCKED | APP-003, DB-004 | Unassigned |
| GC-002 | Dataset/artifact cleanup | Garbage Collector | BLOCKED | GC-001, WORKER-003 | Unassigned |
| GC-003 | Run/log retention cleanup | Garbage Collector | BLOCKED | GC-001 | Unassigned |

## Track C — Python Execution Backend

| ID | Work Item | Workstream | Status | Depends On | Owner |
|---|---|---|---|---|---|
| WORKER-001 | Worker runtime foundation | Worker | BLOCKED | APP-004, CONTRACT-008 | Unassigned |
| WORKER-002 | PostgreSQL job claiming and heartbeat | Worker | BLOCKED | WORKER-001, DB-003 | Unassigned |
| WORKER-003 | Dataset storage abstraction | Worker | BLOCKED | WORKER-001, CONTRACT-004 | Unassigned |
| WORKER-004 | Source/Transform/Export registries | Worker | BLOCKED | WORKER-001, CONTRACT-003, PIPELINE-003 | Unassigned |
| WORKER-005 | Cancellation and terminal cleanup signaling | Worker | BLOCKED | WORKER-002, WORKER-003 | Unassigned |
| WORKER-006 | Checkpoint execution lifecycle | Worker | BLOCKED | WORKER-002, DB-004, CONTRACT-005 | Unassigned |

## Integrated ETL Components

These can also proceed concurrently once the worker runtime and registries are complete.

| ID | Work Item | Workstream | Status | Depends On | Owner |
|---|---|---|---|---|---|
| SOURCE-001 | CSV Source | Sources | BLOCKED | WORKER-003, WORKER-004 | Unassigned |
| SOURCE-002 | XLSX Source | Sources | BLOCKED | WORKER-003, WORKER-004 | Unassigned |
| SOURCE-003 | JSON Source | Sources | BLOCKED | WORKER-003, WORKER-004 | Unassigned |
| SOURCE-004 | REST API Source | Sources | BLOCKED | WORKER-004, WORKER-006 | Unassigned |
| SOURCE-005 | PostgreSQL Source | Sources | BLOCKED | WORKER-004, WORKER-006 | Unassigned |
| TRANSFORM-001 | Column transform set | Transforms | BLOCKED | WORKER-003, WORKER-004 | Unassigned |
| TRANSFORM-002 | Row transform set | Transforms | BLOCKED | WORKER-003, WORKER-004 | Unassigned |
| TRANSFORM-003 | Value/type transform set | Transforms | BLOCKED | WORKER-003, WORKER-004 | Unassigned |
| TRANSFORM-004 | Document-to-tabular flatten transform | Transforms | BLOCKED | WORKER-003, WORKER-004 | Unassigned |
| EXPORT-001 | CSV artifact Export | Exports | BLOCKED | WORKER-003, WORKER-004, DB-004 | Unassigned |
| EXPORT-002 | JSON artifact Export | Exports | BLOCKED | WORKER-003, WORKER-004, DB-004 | Unassigned |
| EXPORT-003 | Parquet artifact Export | Exports | BLOCKED | WORKER-003, WORKER-004, DB-004 | Unassigned |
| EXPORT-004 | PostgreSQL Export | Exports | BLOCKED | WORKER-004, DB-005 | Unassigned |

## Integration, API, and Operations

| ID | Work Item | Workstream | Status | Depends On | Owner |
|---|---|---|---|---|---|
| OBS-001 | Structured run events and metrics | Observability | BLOCKED | DB-002, CONTRACT-005 | Unassigned |
| OBS-002 | System health aggregation | Observability | BLOCKED | OBS-001, SCHED-003, WORKER-002, GC-001 | Unassigned |
| API-001 | OpenAPI generation baseline | API | BLOCKED | CONTRACT-007, WEB-001 | Unassigned |
| API-002 | API token model and authentication | API | BLOCKED | API-001, WEB-003, DB-002 | Unassigned |
| PORTABILITY-001 | Pipeline definition export | Portability | BLOCKED | PIPELINE-004, WEB-006 | Unassigned |
| PORTABILITY-002 | Pipeline definition import | Portability | BLOCKED | PORTABILITY-001 | Unassigned |
| INTEGRATION-001 | End-to-end file pipeline | Integration | BLOCKED | WEB-006, SCHED-003, SOURCE-001, TRANSFORM-001, EXPORT-001, GC-002 | Unassigned |
| INTEGRATION-002 | End-to-end scheduled API pipeline | Integration | BLOCKED | WEB-006, SCHED-003, SOURCE-004, EXPORT-004, WORKER-006 | Unassigned |

## Deferred areas

| Area | Status | Reason |
|---|---|---|
| Plugins | DEFERRED | Requires dedicated security/runtime design |
| Plugin sandboxing | DEFERRED | Depends on plugin architecture |
| Pipeline templates | DEFERRED | Depends on plugin/import model |
| UI custom code | DEFERRED | Explicitly excluded |
| Hosted SaaS | DEFERRED | Self-hosting is primary |
| Global Connections | DEFERRED | Pipelines own connections |
| Global Schedules | DEFERRED | Pipelines own schedules |
| Complex environment promotion | DEFERRED | Not part of current product model |
