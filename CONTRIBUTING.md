# Contributing to PantaETL

PantaETL is designed for concurrent contribution by humans and coding agents.

## Before contributing

Read:

- `AGENTS.md`
- `ROADMAP.md`
- the assigned `docs/tasks/*.md`
- the relevant `docs/workstreams/*.md`
- applicable architecture documents
- applicable ADRs

## Task claiming

Before starting a roadmap item:

- verify dependencies;
- mark the detailed task IN PROGRESS;
- add yourself as owner if an identifier is available;
- update the roadmap row.

Do not work on a task already owned by another contributor unless coordination is explicit.

## Branches and commits

Prefer narrowly scoped branches.

Commit messages describe actual software behavior.

Good:

- `Add pipeline state validation`
- `Implement source checkpoint persistence`
- `Add accessible select primitive`

Bad:

- `Complete TASK-001`
- `Implement roadmap phase 2`
- `Follow architecture section 4`

## Pull requests

Explain:

- behavior changed;
- why it changed;
- workstream;
- contracts affected;
- tests performed;
- migration impact;
- accessibility/localization impact where applicable.

## Architecture changes

Create an ADR when materially altering:

- service boundaries;
- storage strategy;
- job queue strategy;
- contract ownership;
- Source/Transform/Export responsibilities;
- authentication;
- security boundaries;
- deployment dependencies;
- major framework choices.

## Function documentation

Public/exported and non-trivial internal functions require useful descriptions.

Comments explain non-obvious reasons and invariants, not obvious syntax.

## Frontend

All frontend work must:

- use the design system;
- remain accessible;
- localize user-facing strings;
- support light/dark themes;
- avoid emojis;
- use icons sparingly;
- respect reduced motion.

## Python

Use:

- Python 3.13
- uv
- Ruff
- mypy
- pytest
- Pydantic
- Polars / PyArrow where appropriate

## TypeScript

Use:

- pnpm
- Zod
- Drizzle for normal relational work
- raw PostgreSQL SQL where database-specific behavior is clearer
- Vitest
- Playwright

## License

Contributions are distributed under the MIT License.
