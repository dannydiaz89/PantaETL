# Contributing to PantaETL

Thanks for helping build PantaETL. This guide explains how to make a safe,
reviewable change. For product context, architecture, prerequisites, and the
local-stack walkthrough, start with the [README](README.md). This document
focuses on the contribution workflow rather than repeating it.

## Start here

Before changing code or documentation, read the material that defines the
boundary of your change:

- [AGENTS.md](AGENTS.md) for repository-wide engineering rules;
- [ROADMAP.md](ROADMAP.md) and the applicable task file for planned work;
- the matching document in [docs/workstreams](docs/workstreams);
- relevant [architecture documents](docs/architecture) and [ADRs](docs/adr).

For planned work, follow the detailed [task workflow](docs/development/task-workflow.md):
claim a `READY` task, verify its dependencies, mark it in progress, and update
the task and roadmap only after its acceptance criteria pass. Do not take over
an in-progress task without coordinating with its owner.

If your proposal is not represented by an existing task, discuss its scope and
architecture impact before beginning broad implementation.

## Local development and common commands

Install both the Node.js and Python environments once:

```bash
pnpm setup
```

Copy [`.env.example`](.env.example) to `.env`, set the required local values,
then start the normal development stack:

```bash
pnpm stack:up
```

This manages local services and a Docker-backed PostgreSQL database. It is safe
to run again to restart the supervised services while retaining local database
data. Use `pnpm stack:status` to inspect the stack. Use the destructive
`pnpm stack:reset` only when it is acceptable to discard local Compose volumes.

These are the commands contributors commonly need:

| Purpose | Command |
|---|---|
| Regenerate contracts and route artifacts | `pnpm generate` |
| Verify generated artifacts are current | `pnpm generate:check` |
| Run TypeScript, service, web, and accessibility checks | `pnpm check` |
| Run Python lint, format, type, and test checks | `pnpm worker:check` |
| Run the web app alone | `pnpm dev` |
| Generate a deliberate database migration | `pnpm db:migration:generate` |
| Apply committed migrations locally | `pnpm db:migrate` |

Run the narrowest relevant check while iterating, then run the appropriate full
checks before requesting review. CI runs TypeScript quality checks (including
browser accessibility tests), Python checks, and Compose/migration validation
on every push and pull request.

## Change boundaries

Keep a change focused on the package or service that owns it. The main ownership
areas are:

- `apps/web` — control plane and browser UI;
- `apps/scheduler` — schedule claiming and run/job creation;
- `apps/garbage-collector` — retention cleanup;
- `packages/contracts` — cross-service contract interfaces;
- `packages/database` — PostgreSQL schema and migrations;
- `packages/ui` — design-system components;
- `packages/pipeline` — pipeline domain rules;
- `workers/python` — execution components and worker runtime.

Cross-boundary changes are sometimes necessary. When they are, update the
shared contract deliberately, update every affected consumer, and validate the
whole affected path. Do not duplicate a contract just to avoid that work.

### Contracts and generated files

JSON Schema in [`schemas/contracts`](schemas/contracts) is the canonical
cross-service contract source. Do not hand-edit generated TypeScript or Python
contract artifacts. Change the schema, run `pnpm generate`, commit the generated
output, and run `pnpm generate:check`.

### Database changes

Use committed Drizzle migrations. Generate a migration with
`pnpm db:migration:generate`, inspect both the SQL and migration metadata, and
apply it to a fresh local database before review. Do not use schema push as a
substitute for a migration.

### Frontend changes

Use [`packages/ui`](packages/ui) for feature UI; application code must not
import Radix primitives directly. All visible text must come from the typed
locale catalog. Preserve light and dark themes, keyboard operation, focus
management, reduced-motion support, and WCAG 2.2 AA behavior. Add or extend
accessible browser coverage when a user interaction changes.

### Sources, transforms, exports, and secrets

Preserve the execution model:

```text
Trigger → Source → Transform(s) → Export
```

Sources may access explicitly assigned credentials and external systems.
Transforms operate only on datasets and must not use connection credentials or
normal network I/O. Exports own destination delivery and retry behavior. Never
put credentials, secret values, or record contents in browser responses, logs,
errors, fixtures, or portable pipeline exports.

## Branches, commits, and pull requests

Use a narrowly scoped branch. Keep each commit independently understandable and
avoid bundling formatting-only or unrelated refactors with behavior changes.

Commit messages should describe the software behavior, for example:

- `Add atomic job claiming`
- `Validate transform input contracts`
- `Add pipeline artifact retention`

Do not use task IDs, roadmap phases, or planning-document references in commit
messages, source comments, runtime logs, or user-facing text.

A pull request should state:

- the behavior changed and why;
- the affected service, package, or contract;
- validation performed;
- migration and rollout impact, if any;
- accessibility, localization, and security considerations when relevant.

For architecture-level changes—such as service boundaries, storage, queueing,
authentication, contract ownership, or deployment dependencies—add an ADR and
link it from the pull request.

## Before requesting review

- [ ] The change is scoped to its owner boundary, or cross-boundary impact is documented.
- [ ] Public and non-trivial internal code has useful descriptions; comments explain invariants rather than syntax.
- [ ] User-visible UI text is localized and affected UI interactions are accessible.
- [ ] Secrets and record data cannot appear in logs, errors, browser responses, or exported definitions.
- [ ] Generated contracts/routes are current, if applicable.
- [ ] Database migrations are committed and validated, if applicable.
- [ ] Relevant checks pass locally, including `pnpm check` and/or `pnpm worker:check`.
- [ ] Task acceptance criteria and roadmap status are updated for planned work.

## License

By contributing, you agree that your contributions are distributed under the
[MIT License](LICENSE).
