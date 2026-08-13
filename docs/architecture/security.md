# Security Model

## Trust boundaries

Assume user input, files, remote data, scraped content, and pipeline configuration are untrusted.

Administrator-installed future plugins are administrator-trusted software.

## Authentication

Initial local username/email + password.

Better Auth is the planned foundation.

Only admins create accounts.

Admins may grant admin status.

Ordinary users manage/run their pipelines.

Admins additionally manage users and global settings.

## First admin

Fresh deployment creates first admin and a one-time temporary password.

First login forces password change.

Do not regenerate on every normal restart.

## Password recovery

Provide an explicit CLI/container reset command.

Do not rely on persistent compose flags such as `RESET_PASSWORD=true`.

## Secrets

Encrypt connection secrets at rest.

Encryption key is supplied outside PostgreSQL.

Secrets:

- are not returned to browser;
- are not logged;
- are not included as plaintext in snapshots;
- are not included as usable values in standalone pipeline exports.

Full disaster-recovery backup may include encrypted values but requires the separate encryption key.

## Transform privilege

Transform receives no connection credentials.

Normal Transform context provides no platform secret provider or network client.

## Logs/privacy

Avoid storing records.

Use safe context such as row index, filename, field, component, and reason.

Redact known secrets in headers, URLs, query parameters, and config.

## Files

Protect against path traversal, unsafe archive extraction, oversized uploads, unexpected file types, and temporary-file leakage.

## API tokens

Users may create revocable API tokens inheriting their permissions.
