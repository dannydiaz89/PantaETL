# Pipeline Builder Phase Roadmap

Authoritative tracker for this phase. Statuses: `READY`, `IN PROGRESS`, `COMPLETE`, `BLOCKED`.

Before work: read `AGENTS.md`, phase docs, verify dependencies, mark task/row IN PROGRESS, set owner. On completion: satisfy criteria/checks, mark COMPLETE, and do not begin another task unless assigned. Task IDs never belong in implementation comments or commit messages.

| ID | Task | Status | Depends On | Owner |
|---|---|---|---|---|
| CAP-001 | Generate built-in component capability catalog | COMPLETE | — | Codex |
| CAP-002 | Add component capability API contracts | COMPLETE | CAP-001 | Codex |
| CAP-003 | Expose component capability API | COMPLETE | CAP-002 | Codex |
| CAP-004 | Add frontend component capability query layer | COMPLETE | CAP-003 | Codex |
| FORM-001 | Generic component configuration renderer | READY | CAP-002 | Unassigned |
| FORM-002 | Write-only secret field and binding UX | BLOCKED | FORM-001 | Unassigned |
| FORM-003 | Component picker foundation | BLOCKED | CAP-004, FORM-001 | Unassigned |
| BUILDER-001 | Three-step wizard shell and local draft model | BLOCKED | FORM-003 | Unassigned |
| BUILDER-002 | Source selection and configuration step | BLOCKED | BUILDER-001 | Unassigned |
| BUILDER-003 | Transform add/configure/remove/reorder step | BLOCKED | BUILDER-002 | Unassigned |
| BUILDER-004 | Export selection and configuration step | BLOCKED | BUILDER-003 | Unassigned |
| BUILDER-005 | Deterministic linear graph derivation | BLOCKED | BUILDER-002 | Unassigned |
| BUILDER-006 | Draft persistence and resume | BLOCKED | BUILDER-004, BUILDER-005, FORM-002 | Unassigned |
| BUILDER-007 | Reuse builder editors for existing pipelines | BLOCKED | BUILDER-006 | Unassigned |
| VALID-001 | Compatibility-aware component selection | BLOCKED | CAP-004, BUILDER-003 | Unassigned |
| VALID-002 | Separate draft validation from executable validation | BLOCKED | BUILDER-005 | Unassigned |
| VALID-003 | Enforce executable validation on enable | BLOCKED | VALID-002 | Unassigned |
| VALID-004 | Preserve unsaved builder state on lock conflicts | BLOCKED | BUILDER-006 | Unassigned |
| TRIGGER-001 | Replace read-only trigger panel with pipeline trigger editor | BLOCKED | BUILDER-007 | Unassigned |
| E2E-001 | Real create/configure/save/reload browser workflow | BLOCKED | BUILDER-007, VALID-003 | Unassigned |
| E2E-002 | Enable/run/lock/duplicate/delete browser workflow | BLOCKED | E2E-001, VALID-004 | Unassigned |
| CLEAN-001 | Remove obsolete CSV-specific creation and fixtures | BLOCKED | E2E-002 | Unassigned |

After CAP-002, CAP-003 and FORM-001 can proceed in parallel. Avoid multiple agents heavily editing the wizard component tree simultaneously.
