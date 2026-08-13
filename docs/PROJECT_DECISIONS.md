# PantaETL Project Decisions

## Product
- Name: PantaETL
- License: MIT
- Audience: data analysts and data scientists first
- Self-hosted first
- Source → Transform → Export
- Trigger separate from Source

## TypeScript
- pnpm
- no Turborepo by default
- TanStack Start/Router/Query/Form/Table
- Zod
- Drizzle / Drizzle Kit
- Better Auth
- Vitest
- Playwright

## Frontend
- own design system
- Radix behind design-system boundary
- Tailwind
- Lucide
- dark/light themes
- WCAG 2.2 AA
- i18n from the beginning
- no emojis
- restrained visual design

## Python
- Python 3.13
- uv
- Pydantic
- Polars
- PyArrow
- Parquet
- Ruff
- mypy
- pytest

## Infrastructure
- PostgreSQL
- PostgreSQL-backed job queue
- local internal storage by default
- optional S3-compatible storage
- Docker Compose
- GitHub Actions
- garbage collector service

## Pipeline rules
- pipeline editable only when not running
- enabled/disabled
- same-pipeline runs serialize
- different pipelines may run concurrently
- retries restart from beginning
- checkpoints commit only after success
- pipelines interruptible
- temporary datasets deleted
- artifact default retention 30 days
- run/log default retention one year

## Accounts
- local password auth initially
- first user admin
- admin creates accounts
- ordinary users manage/run their pipelines
- admins manage users/global settings
- deleted-user pipelines transfer to admin with historical metadata

## Portability
- pipeline definition export/import
- imported pipelines disabled/draft
- usable credentials excluded
- missing required components cause import error

## Deferred
- plugins
- plugin sandboxing
- templates
- arbitrary UI custom code
- hosted SaaS

## Delivery strategy
- repository foundation first
- complete application/service topology second
- shared contracts third
- frontend, backend control plane, and Python execution then proceed in parallel
