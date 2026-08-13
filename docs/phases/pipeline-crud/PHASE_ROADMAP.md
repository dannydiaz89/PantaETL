# Pipeline CRUD & UI Wiring Roadmap

Statuses: READY, IN PROGRESS, COMPLETE, BLOCKED.

Before starting a task: verify dependencies, mark it IN PROGRESS, set Owner, then work only within scope.
When complete: satisfy all acceptance criteria, mark COMPLETE, update this roadmap, and do not start another task unless assigned.
Task IDs must never appear in implementation comments or commit messages.

| ID | Task | Status | Depends On | Owner |
|---|---|---|---|---|
| CRUD-001 | Pipeline API contracts | COMPLETE | — | Codex |
| CRUD-002 | Pipeline repository read operations | COMPLETE | CRUD-001 | pipeline_reads |
| CRUD-003 | Pipeline repository create operation | COMPLETE | CRUD-001 | pipeline_create |
| CRUD-004 | Pipeline repository update operation | COMPLETE | CRUD-002, CRUD-003 | pipeline_update |
| CRUD-005 | Pipeline repository delete operation | COMPLETE | CRUD-002 | pipeline_delete |
| CRUD-006 | Pipeline duplication operation | COMPLETE | CRUD-003, CRUD-004 | pipeline_duplicate |
| CRUD-007 | Pipeline run/state action service | COMPLETE | CRUD-002 | pipeline_actions |
| API-CRUD-001 | Pipeline list/create routes | BLOCKED | CRUD-002, CRUD-003 | Unassigned |
| API-CRUD-002 | Pipeline get/update/delete routes | BLOCKED | CRUD-004, CRUD-005 | Unassigned |
| API-CRUD-003 | Pipeline duplicate/run/state routes | BLOCKED | CRUD-006, CRUD-007 | Unassigned |
| API-CRUD-004 | OpenAPI coverage | BLOCKED | API-CRUD-001, API-CRUD-002, API-CRUD-003 | Unassigned |
| UI-WIRE-001 | Pipeline query/mutation layer | BLOCKED | API-CRUD-001, API-CRUD-002 | Unassigned |
| UI-WIRE-002 | Pipeline workspace decomposition | BLOCKED | CRUD-001 | Unassigned |
| UI-WIRE-003 | Replace pipeline fixtures | BLOCKED | UI-WIRE-001, UI-WIRE-002 | Unassigned |
| UI-WIRE-004 | Wire create/update/delete | BLOCKED | UI-WIRE-003 | Unassigned |
| UI-WIRE-005 | Wire duplicate/run/enable-disable | BLOCKED | API-CRUD-003, UI-WIRE-003 | Unassigned |
| UI-WIRE-006 | Loading/error/empty/accessibility states | BLOCKED | UI-WIRE-003 | Unassigned |
| INT-CRUD-001 | Pipeline CRUD integration tests | BLOCKED | API-CRUD-004 | Unassigned |
| INT-CRUD-002 | Pipeline UI E2E tests | BLOCKED | UI-WIRE-004, UI-WIRE-005, UI-WIRE-006 | Unassigned |
| INT-CRUD-003 | Remove obsolete fixtures | BLOCKED | INT-CRUD-002 | Unassigned |

Recommended parallelization after CRUD-001:
- Agent A: CRUD-002
- Agent B: CRUD-003
- Agent C: UI-WIRE-002
