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
| API-CRUD-001 | Pipeline list/create routes | COMPLETE | CRUD-002, CRUD-003 | api_pipeline_collection |
| API-CRUD-002 | Pipeline get/update/delete routes | COMPLETE | CRUD-004, CRUD-005 | api_pipeline_detail |
| API-CRUD-003 | Pipeline duplicate/run/state routes | COMPLETE | CRUD-006, CRUD-007 | api_pipeline_actions |
| API-CRUD-004 | OpenAPI coverage | COMPLETE | API-CRUD-001, API-CRUD-002, API-CRUD-003 | api_pipeline_openapi |
| UI-WIRE-001 | Pipeline query/mutation layer | COMPLETE | API-CRUD-001, API-CRUD-002 | web_pipeline_data |
| UI-WIRE-002 | Pipeline workspace decomposition | COMPLETE | CRUD-001 | web_pipeline_decomposition |
| UI-WIRE-003 | Replace pipeline fixtures | COMPLETE | UI-WIRE-001, UI-WIRE-002 | web_pipeline_api_data |
| UI-WIRE-004 | Wire create/update/delete | COMPLETE | UI-WIRE-003 | ui_pipeline_mutations |
| UI-WIRE-005 | Wire duplicate/run/enable-disable | COMPLETE | API-CRUD-003, UI-WIRE-003 | ui_pipeline_actions |
| UI-WIRE-006 | Loading/error/empty/accessibility states | COMPLETE | UI-WIRE-003 | ui_pipeline_states |
| INT-CRUD-001 | Pipeline CRUD integration tests | COMPLETE | API-CRUD-004 | pipeline_crud_integration |
| INT-CRUD-002 | Pipeline UI E2E tests | BLOCKED | UI-WIRE-004, UI-WIRE-005, UI-WIRE-006 | Unassigned |
| INT-CRUD-003 | Remove obsolete fixtures | BLOCKED | INT-CRUD-002 | Unassigned |

Recommended parallelization after CRUD-001:
- Agent A: CRUD-002
- Agent B: CRUD-003
- Agent C: UI-WIRE-002
