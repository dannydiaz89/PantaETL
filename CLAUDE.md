# PantaETL Claude Instructions

Follow `AGENTS.md` as the repository-wide source of development rules.

## Project sequencing

Follow the roadmap order: repository foundation → complete application skeleton → shared contracts → parallel frontend/backend tracks → integration.

Do not implement detailed contracts before the application topology exists unless explicitly instructed to change the roadmap.

## Required task workflow

Before editing:

1. Open `ROADMAP.md`.
2. Open the assigned task under `docs/tasks/`.
3. Verify dependencies are COMPLETE.
4. Mark the task and roadmap row IN PROGRESS.
5. Read the relevant workstream.
6. Read the relevant architecture documents and ADRs.
7. Inspect existing contracts before inventing new interfaces.

When complete:

1. run acceptance checks;
2. update the task checklist;
3. mark task and roadmap row COMPLETE;
4. do not start another task unless assigned.

When blocked:

1. mark task and roadmap row BLOCKED;
2. record the blocker;
3. do not invent an architectural workaround.

## Scope discipline

Do not broadly refactor unrelated code.

Prefer changes inside the assigned workstream.

Do not take over a task already IN PROGRESS by another owner unless explicitly instructed.

## Architectural constraints

- Preserve Source → Transform → Export.
- Trigger is separate from Source.
- Do not add arbitrary user-entered executable code.
- Transform does not receive secrets and does not perform normal network I/O.
- Pipelines own their Source/Export connections.
- Same-pipeline runs do not execute concurrently.
- Different pipelines may execute concurrently.
- Checkpoints advance only after successful pipeline completion.
- Temporary datasets are disposable.
- File artifacts follow retention policy.
- PostgreSQL is the initial job queue.
- Prefer `FOR UPDATE SKIP LOCKED` semantics for job claiming.
- Do not hold a DB transaction open during ETL work.
- Internal storage is local filesystem by default and may be S3-compatible.
- External providers such as Google Drive are connectors, not engine scratch storage.
- Do not introduce infrastructure without an ADR.

## UI constraints

- Import UI components from the PantaETL design system.
- Do not import Radix directly from feature code.
- No emojis.
- Use icons sparingly.
- No hardcoded user-facing English.
- Accessibility is required.
- Respect reduced motion.
- Preserve light/dark theme support.
- Do not invent arbitrary colors outside design tokens.

## Comments and commits

Do not mention:

- this file;
- `AGENTS.md`;
- task IDs;
- roadmap phases;
- architecture section numbers;
- prompts;
- agents;
- user instructions

in source comments, docstrings, commit messages, PR titles, logs, or user-visible text.

Describe software behavior itself.

## Function descriptions

Document exported/public functions and non-trivial internal functions.

Useful descriptions explain:

- responsibility;
- important arguments/results;
- side effects;
- locking/transaction expectations;
- security boundaries;
- lifecycle invariants;
- error behavior.

Avoid empty descriptions that simply restate names.

## Final checks

Before reporting completion:

- run tests;
- run static analysis;
- inspect diff scope;
- confirm no unrelated workstream was modified;
- confirm contract consumers were updated when necessary;
- confirm UI text is localized;
- confirm UI uses the design system;
- confirm non-trivial functions are documented;
- update task and roadmap status.
