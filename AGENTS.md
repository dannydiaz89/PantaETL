# PantaETL Agent Instructions

These instructions apply to every coding agent and contributor working in this repository.

## Required reading before work

Before changing implementation:

1. Read `ROADMAP.md`.
2. Open the assigned task file under `docs/tasks/`.
3. Verify all listed dependencies are COMPLETE.
4. Read the relevant workstream under `docs/workstreams/`.
5. Read the relevant architecture document(s).
6. Read applicable ADRs.
7. Confirm the requested change belongs to the workstream being modified.

Do not begin broad implementation before understanding the task boundary.


## Roadmap sequencing

The intended project sequence is:

1. repository foundation;
2. complete application/service/package scaffolding;
3. shared contracts and pipeline-domain boundaries;
4. parallel frontend, control-plane backend, and Python execution work;
5. integrated ETL components and end-to-end validation.

Do not skip application scaffolding and jump directly into detailed contracts or feature implementation unless the roadmap dependencies have been deliberately changed.

After the parallelization gate is reached, independent agents should preferentially claim tasks from different tracks to minimize conflicts.


## Roadmap and task workflow

`ROADMAP.md` is the authoritative project dashboard.

Detailed work is tracked in individual files under `docs/tasks/`.

### Before beginning a task

1. Confirm its status is READY.
2. Confirm every dependency task is COMPLETE.
3. Change the task status to IN PROGRESS.
4. Add the current owner/agent identifier if one was provided.
5. Update the matching roadmap row to IN PROGRESS.
6. Work only within the task scope unless a required contract change crosses boundaries.

### When a task is complete

1. Run every acceptance check defined by the task.
2. Mark each satisfied acceptance criterion complete.
3. Add concise implementation notes only when useful.
4. Change task status to COMPLETE only when all required criteria pass.
5. Update the matching roadmap row to COMPLETE.
6. Do not automatically start the next task unless explicitly assigned.

### When a task is blocked

1. Change its status to BLOCKED.
2. Record the blocker in the task file.
3. Update the matching roadmap row to BLOCKED.
4. Do not bypass architecture or security rules to unblock yourself.

### Concurrent agent behavior

Multiple agents may work at the same time.

Prefer tasks that modify separate ownership directories.

Do not claim a task already marked IN PROGRESS by another owner unless explicitly instructed.

If a cross-boundary contract change is required:

1. identify the shared contract;
2. update that contract deliberately;
3. update affected consumers;
4. run all affected tests;
5. note the cross-boundary dependency in the task.

## Documentation hygiene

Architecture and task documentation guide implementation, but implementation artifacts must describe software behavior directly.

Never reference planning documents or agent instructions in:

- source-code comments;
- docstrings;
- commit messages;
- pull-request titles;
- runtime logs;
- exception messages;
- user-facing text.

Do not write:

- `Per AGENTS.md...`
- `According to ROADMAP.md...`
- `Architecture v0.1 requires...`
- `Complete FOUNDATION-001`
- `Phase 2 implementation`
- `As requested...`
- `From the prompt...`

Commit messages describe the software change:

- `Add atomic job claiming`
- `Validate transform input contracts`
- `Add pipeline artifact retention`
- `Prevent concurrent runs of the same pipeline`

Documentation may cross-reference other documentation when useful to a human reader.

## Code maintainability

Prefer explicit, maintainable code over clever abstractions.

- Keep modules focused.
- Prefer descriptive identifiers.
- Avoid oversized functions and files.
- Preserve strong typing.
- Avoid TypeScript `any` unless the boundary genuinely represents unknown data.
- Validate TypeScript boundaries with Zod.
- Validate Python boundaries with Pydantic.
- Avoid duplicate canonical contracts across languages.
- Public/exported functions, classes, interfaces, and non-trivial internal functions must have concise, useful descriptions.
- Trivial private helpers do not require ceremonial documentation.
- Function descriptions should explain responsibility, important inputs/outputs, side effects, constraints, transaction behavior, security boundaries, or invariants when relevant.
- Comments should explain why, not narrate obvious code.
- Do not add comments merely to satisfy a perceived documentation quota.

Good comment:

> The checkpoint is committed only after successful Export so a failed run cannot cause later runs to skip unexported data.

Bad comment:

> Increment attempts by one.

## Architectural boundaries

Core data flow:

**Source → Transform → Export**

A Trigger starts a pipeline but is separate from the data chain.

### Source

A Source acquires data.

A Source may:

- access network resources;
- access explicitly assigned credentials;
- read external databases;
- call APIs;
- scrape websites;
- read files or external storage;
- maintain Source-specific checkpoints.

### Transform

A Transform manipulates data.

Transforms:

- receive datasets;
- return datasets;
- do not receive connection credentials;
- do not use network I/O as part of the normal Transform contract;
- own the logic for converting supported dataset contracts.

Do not add UI-entered arbitrary code execution.

### Export

An Export delivers processed data.

An Export may:

- access assigned destination credentials;
- write files;
- write external databases;
- call external destination services.

Each Export implementation owns safe retry behavior appropriate to its destination.

## Pipeline execution rules

- A pipeline may be enabled or disabled.
- Pipeline configuration is locked while that pipeline has an active run.
- Different pipelines may execute concurrently.
- A single pipeline has at most one active run.
- Additional runs for the same pipeline queue.
- A failed pipeline retry restarts from the beginning.
- Pipelines are interruptible.
- Cancellation must clean temporary execution datasets.
- Checkpoints advance only after successful pipeline completion.
- Branch failures stop the pipeline.
- Temporary datasets are deleted after terminal run state.
- Retained file artifacts follow retention policy.
- Default artifact retention is 30 days.
- Run and log retention default to one year and are globally configurable.

## Data privacy and secrets

- Never log credentials.
- Never expose stored secrets back to the browser.
- Encrypt secrets at rest.
- Standalone pipeline exports must not contain usable credentials.
- Avoid storing actual record contents in logs, metrics, run history, or errors.
- Errors should use safe context such as file, row index, field, or operation.
- Sensitive query parameters and headers must be redactable.
- Temporary datasets must support encryption at rest.
- Network restrictions beyond application-level controls remain primarily a self-hosting administrator responsibility.

## Frontend rules

The design system is mandatory.

- Feature code must use `packages/ui`.
- Only `packages/ui` may depend directly on Radix primitives.
- Do not import Radix directly in application feature code.
- Tailwind usage follows design-system conventions and tokens.
- No arbitrary color systems.
- Dark mode is required.
- Light mode is required.
- Dark mode should be restrained and developer-tool-like.
- Use a simple primary accent.
- No emojis in application UI.
- Use Lucide only when an icon adds useful meaning.
- Do not decorate every option with icons.
- Accessibility is a functional requirement.
- Target WCAG 2.2 AA.
- Keyboard use, screen readers, focus management, contrast, and reduced motion must be considered.
- Respect `prefers-reduced-motion`.
- Data tables must be accessible and performant.
- Desktop is primary, but smaller screens must remain usable.
- All user-facing text must use localization.
- English is the first locale, not hardcoded source text.
- Dates, times, numbers, units, relative times, and pluralization must be locale-aware.

## Testing expectations

### TypeScript

- Vitest for unit/integration tests.
- Playwright for browser/end-to-end tests.
- Representative accessibility checks in CI.

### Python

- pytest
- Ruff
- mypy

Contracts and migrations must have compatibility/consistency tests.

## Infrastructure rules

Do not introduce Redis, RabbitMQ, Kafka, MongoDB, Elasticsearch, or another infrastructure dependency without an ADR demonstrating why PostgreSQL/current storage is insufficient.

The default deployment must remain self-hostable and understandable.

Core services:

- web;
- scheduler;
- worker;
- garbage collector;
- PostgreSQL;
- configured internal storage.

## Ownership boundaries

Typical ownership:

- `apps/web` — web/control-plane.
- `apps/scheduler` — scheduler.
- `apps/garbage-collector` — retention cleanup.
- `packages/contracts` — contracts.
- `packages/database` — PostgreSQL/migrations.
- `packages/ui` — design system.
- `packages/pipeline` — pipeline domain rules.
- `workers/python` — execution plane.

Do not modify unrelated workstreams merely because it is convenient.

## Completion criteria

A task is not complete because code compiles.

Before finishing:

- run relevant tests;
- run linting/type checks;
- verify localization rules;
- verify design-system compliance for UI work;
- verify accessibility for UI work;
- verify migrations for database changes;
- verify function documentation;
- update the task tracker;
- update architecture docs only when architecture actually changed;
- create an ADR for significant architecture changes.
