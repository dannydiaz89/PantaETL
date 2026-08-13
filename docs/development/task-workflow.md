# Task Workflow

## Purpose

PantaETL uses `ROADMAP.md` as a project dashboard and `docs/tasks/` for detailed work tracking.

## Starting work

1. Select/receive a READY task.
2. Open the task file.
3. Verify dependencies.
4. Set task status to IN PROGRESS.
5. Set owner.
6. Set roadmap row to IN PROGRESS.
7. Read workstream/architecture docs.
8. Implement only the defined scope.

## Completion

1. Run all task acceptance checks.
2. Mark completed checkboxes.
3. Add concise implementation notes if useful.
4. Set task status COMPLETE.
5. Set roadmap row COMPLETE.

## Blocked work

If blocked:

- set task and roadmap row BLOCKED;
- record the blocker;
- stop rather than violating architecture.

## Concurrent work

Prefer tasks with different ownership directories.

Do not start a task already marked IN PROGRESS by another owner.

## Implementation hygiene

Task IDs belong in task tracking, not code comments or commit messages.
