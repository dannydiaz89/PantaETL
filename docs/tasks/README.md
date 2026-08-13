# PantaETL Tasks

`ROADMAP.md` is the authoritative dashboard.

Each detailed task file contains scope, ownership, dependencies, acceptance criteria, and blockers.

## Development sequencing

Tasks are intentionally organized as:

1. `foundation/`
2. `application-setup/`
3. `contracts/`
4. parallel frontend/backend execution tracks
5. integrated ETL components and system features

This ordering creates every application boundary before finalizing shared contracts, then enables multiple agents to work concurrently.

## Workflow

Before starting:

- verify dependencies;
- set task IN PROGRESS;
- set owner;
- update roadmap.

On completion:

- satisfy acceptance criteria;
- mark checklist;
- set task COMPLETE;
- update roadmap.

If blocked:

- mark task and roadmap BLOCKED;
- record blocker;
- do not violate architecture to work around it.

Task IDs belong only in project tracking, not source comments or commit messages.
