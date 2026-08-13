# PantaETL Pipeline CRUD & UI Wiring Phase

This pack defines the next implementation phase after the original roadmap.

The repository already has:
- normalized pipeline tables;
- pipeline execution/edit-lock domain rules;
- canonical Pipeline contracts;
- mocked pipeline and run workspaces;
- auth/OpenAPI/localization/theme/design-system foundations.

The major missing piece is the control-plane CRUD/query layer for pipelines and wiring the UI to it.

Flow:

Pipeline API contracts -> database repository -> authenticated API -> TanStack Query -> real Pipeline UI
