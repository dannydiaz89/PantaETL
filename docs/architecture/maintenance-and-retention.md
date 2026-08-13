# Maintenance, Retention, Backup, and Upgrade

## Defaults

- artifacts: 30 days;
- run history: 1 year;
- logs: 1 year.

Run/log retention is globally configurable.

## Garbage collection

Use explicit ownership/expiry metadata such as `expires_at`.

Do not scan arbitrary files and guess deletion safety.

## Backup

Preserve durable value:

- users;
- pipelines;
- schedules;
- run history;
- checkpoints;
- encrypted secrets for full disaster recovery;
- settings;
- artifact metadata;
- activity history.

Temporary datasets do not require backup.

Encrypted secrets require the separate encryption key.

## Pipeline portability

Standalone pipeline export is separate from backup and omits usable credentials.

## Upgrades

Maintenance-window flow:

1. graceful stop;
2. backup;
3. update images;
4. run/verify migrations;
5. restart;
6. verify health.

Zero downtime is not a baseline requirement.

## Migrations

Use committed Drizzle Kit migrations.

Production does not use schema push.

## Compatibility

Services refuse or avoid unsupported contract versions.
