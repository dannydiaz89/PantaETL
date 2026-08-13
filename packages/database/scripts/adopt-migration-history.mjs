/** Adopt verified pre-journal development migrations before Drizzle applies pending work. */
import { createHash } from "node:crypto";
import console from "node:console";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

const packageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const drizzleDirectory = path.join(packageDirectory, "drizzle");

const migrationFingerprints = new Map([
  [
    "0000_elite_shape",
    {
      constraints: [
        "artifacts_pipeline_id_pipelines_id_fk",
        "artifacts_run_id_runs_id_fk",
        "jobs_component_id_pipeline_components_id_fk",
        "jobs_pipeline_id_pipelines_id_fk",
        "jobs_run_id_runs_id_fk",
        "jobs_run_step_id_run_steps_id_fk",
        "pipeline_components_pipeline_id_pipelines_id_fk",
        "pipeline_edges_from_component_foreign_key",
        "pipeline_edges_pipeline_id_pipelines_id_fk",
        "pipeline_edges_to_component_foreign_key",
        "pipeline_triggers_pipeline_id_pipelines_id_fk",
        "pipelines_owner_user_id_users_id_fk",
        "run_steps_component_id_pipeline_components_id_fk",
        "run_steps_run_id_runs_id_fk",
        "runs_cancellation_requested_by_user_id_users_id_fk",
      ],
      enums: [
        "artifact_storage_kind",
        "component_kind",
        "job_state",
        "pipeline_state",
        "run_state",
        "run_step_state",
        "trigger_type",
      ],
      indexes: [
        "artifacts_run_id_index",
        "jobs_run_id_index",
        "pipeline_components_pipeline_id_index",
        "pipeline_triggers_pipeline_id_index",
        "pipelines_owner_user_id_index",
        "run_steps_run_id_index",
        "runs_pipeline_id_created_at_index",
        "users_email_unique",
        "users_username_unique",
      ],
      tables: [
        "artifacts",
        "jobs",
        "pipeline_components",
        "pipeline_edges",
        "pipeline_triggers",
        "pipelines",
        "run_steps",
        "runs",
        "settings",
        "users",
      ],
    },
  ],
  [
    "0001_fantastic_king_cobra",
    {
      columns: [
        "jobs.attempt",
        "jobs.available_at",
        "jobs.claimed_at",
        "jobs.heartbeat_at",
        "jobs.worker_id",
      ],
      indexes: ["jobs_eligible_work_index"],
    },
  ],
  [
    "0002_clever_miek",
    {
      columns: ["artifacts.expires_at", "runs.expires_at"],
      constraints: [
        "datasets_pipeline_id_pipelines_id_fk",
        "datasets_run_id_runs_id_fk",
        "datasets_run_step_id_run_steps_id_fk",
        "run_logs_run_id_runs_id_fk",
        "source_checkpoints_pipeline_id_pipelines_id_fk",
        "source_checkpoints_source_component_foreign_key",
      ],
      indexes: [
        "artifacts_expiry_index",
        "datasets_expiry_index",
        "datasets_run_id_index",
        "run_logs_expiry_index",
        "run_logs_run_id_index",
      ],
      tables: ["datasets", "run_logs", "source_checkpoints"],
    },
  ],
  [
    "0003_dashing_black_cat",
    {
      constraints: ["connection_secrets_owner_user_id_users_id_fk"],
      indexes: ["connection_secrets_owner_user_id_index"],
      tables: ["connection_secrets"],
    },
  ],
  [
    "0004_misty_sersi",
    {
      constraints: ["uploads_owner_user_id_users_id_fk"],
      indexes: ["uploads_expiry_index", "uploads_owner_user_id_index"],
      tables: ["uploads"],
    },
  ],
  [
    "0005_odd_mentor",
    {
      columns: ["pipeline_triggers.last_claimed_at", "pipeline_triggers.next_run_at"],
      constraints: ["pipeline_triggers_schedule_fields_check"],
      indexes: ["pipeline_triggers_due_schedule_index"],
    },
  ],
  [
    "0006_uneven_tyger_tiger",
    {
      columns: ["runs.is_active", "runs.scheduled_for", "runs.trigger_id"],
      constraints: ["runs_trigger_id_pipeline_triggers_id_fk"],
      indexes: ["runs_one_active_pipeline_index"],
    },
  ],
  [
    "0007_soft_shriek",
    {
      columns: ["users.email_verified"],
      constraints: ["accounts_user_id_users_id_fk", "sessions_user_id_users_id_fk"],
      indexes: [
        "accounts_user_id_index",
        "sessions_token_unique",
        "sessions_user_id_index",
        "verifications_identifier_index",
      ],
      nullableColumns: ["users.password_hash"],
      tables: ["accounts", "sessions", "verifications"],
    },
  ],
]);

/** Read the migration journal and calculate the hashes Drizzle stores in PostgreSQL. */
async function readMigrations() {
  const journal = JSON.parse(await readFile(path.join(drizzleDirectory, "meta", "_journal.json"), "utf8"));

  return Promise.all(
    journal.entries.map(async (entry) => {
      const contents = await readFile(path.join(drizzleDirectory, `${entry.tag}.sql`));
      return {
        createdAt: entry.when,
        contents: contents.toString("utf8"),
        hash: createHash("sha256").update(contents).digest("hex"),
        index: entry.idx,
        tag: entry.tag,
      };
    }),
  );
}

/** Gather the PostgreSQL catalog values used by the historical migration fingerprints. */
async function readCatalog(sql) {
  const [tables, enums, indexes, constraints, columns, nullableColumns] = await Promise.all([
    sql`select table_name as value from information_schema.tables where table_schema = 'public'`,
    sql`
      select type.typname as value
      from pg_type as type
      inner join pg_namespace as namespace on namespace.oid = type.typnamespace
      where namespace.nspname = 'public' and type.typtype = 'e'
    `,
    sql`select indexname as value from pg_indexes where schemaname = 'public'`,
    sql`select conname as value from pg_constraint where connamespace = 'public'::regnamespace`,
    sql`
      select table_name || '.' || column_name as value
      from information_schema.columns
      where table_schema = 'public'
    `,
    sql`
      select table_name || '.' || column_name as value
      from information_schema.columns
      where table_schema = 'public' and is_nullable = 'YES'
    `,
  ]);

  return {
    columns: new Set(columns.map(({ value }) => value)),
    constraints: new Set(constraints.map(({ value }) => value)),
    enums: new Set(enums.map(({ value }) => value)),
    indexes: new Set(indexes.map(({ value }) => value)),
    nullableColumns: new Set(nullableColumns.map(({ value }) => value)),
    tables: new Set(tables.map(({ value }) => value)),
  };
}

/** Return whether a fingerprint is entirely present, absent, or incomplete. */
function migrationState(catalog, fingerprint) {
  const checks = [
    [catalog.columns, fingerprint.columns ?? []],
    [catalog.constraints, fingerprint.constraints ?? []],
    [catalog.enums, fingerprint.enums ?? []],
    [catalog.indexes, fingerprint.indexes ?? []],
    [catalog.nullableColumns, fingerprint.nullableColumns ?? []],
    [catalog.tables, fingerprint.tables ?? []],
  ];
  const requiredValues = checks.flatMap(([, values]) => values);
  const presentValues = checks.flatMap(([available, values]) =>
    values.filter((value) => available.has(value)),
  );

  if (presentValues.length === 0) {
    return "absent";
  }

  return presentValues.length === requiredValues.length ? "present" : "partial";
}

/** Create Drizzle's journal table only after matching historical schema is verified. */
async function ensureMigrationTable(sql) {
  await sql`create schema if not exists drizzle`;
  await sql`
    create table if not exists drizzle.__drizzle_migrations (
      id serial primary key not null,
      hash text not null,
      created_at bigint
    )
  `;
}

/** Record one migration hash in the same journal Drizzle Kit reads. */
async function recordMigration(sql, migration) {
  await sql`
    insert into drizzle.__drizzle_migrations (hash, created_at)
    values (${migration.hash}, ${migration.createdAt})
    on conflict do nothing
  `;
}

/** Apply a known historical migration statement-by-statement inside one transaction. */
async function applyHistoricalMigration(sql, migration) {
  await sql.begin(async (transaction) => {
    for (const statement of migration.contents.split("--> statement-breakpoint")) {
      if (statement.trim()) {
        await transaction.unsafe(statement);
      }
    }
    await recordMigration(transaction, migration);
  });
}

/** Adopt complete known migrations when a development database has no Drizzle history. */
async function adoptMigrationHistory() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to prepare database migration history.");
  }

  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const [{ migrationTable }] = await sql`
      select to_regclass('drizzle.__drizzle_migrations') as "migrationTable"
    `;
    const existingMigrations = migrationTable
      ? await sql`select hash from drizzle.__drizzle_migrations`
      : [];
    const catalog = await readCatalog(sql);
    const migrations = (await readMigrations()).filter((migration) =>
      migrationFingerprints.has(migration.tag),
    );
    const recordedHashes = new Set(existingMigrations.map(({ hash }) => hash));
    const presentMigrations = [];
    const absentMigrations = [];

    for (const migration of migrations) {
      const fingerprint = migrationFingerprints.get(migration.tag);
      const state = migrationState(catalog, fingerprint);
      if (state === "partial") {
        throw new Error(
          `Cannot adopt migration ${migration.tag}: its schema fingerprint is incomplete. Repair the database before applying migrations.`,
        );
      }
      if (recordedHashes.has(migration.hash) && state !== "present") {
        throw new Error(
          `Migration ${migration.tag} is recorded but its schema fingerprint is missing. Repair the database before applying migrations.`,
        );
      }
      if (state === "present") {
        presentMigrations.push(migration);
      } else {
        absentMigrations.push(migration);
      }
    }

    if (existingMigrations.length === 0 && presentMigrations.length === 0) {
      return;
    }

    const adoptedMigrations = presentMigrations.filter(
      (migration) => !recordedHashes.has(migration.hash),
    );
    const recordedIndexes = migrations
      .filter((migration) => recordedHashes.has(migration.hash) || adoptedMigrations.includes(migration))
      .map((migration) => migration.index);
    const highestRecordedIndex = Math.max(...recordedIndexes);
    const missingHistoricalMigrations = absentMigrations.filter(
      (migration) => migration.index < highestRecordedIndex,
    );

    if (adoptedMigrations.length === 0 && missingHistoricalMigrations.length === 0) {
      return;
    }

    if (!migrationTable) {
      await ensureMigrationTable(sql);
    }

    for (const migration of adoptedMigrations) {
      await recordMigration(sql, migration);
      recordedHashes.add(migration.hash);
    }

    if (adoptedMigrations.length > 0) {
      console.log(
        `Adopted existing migration history: ${adoptedMigrations.map(({ tag }) => tag).join(", ")}.`,
      );
    }

    for (const migration of missingHistoricalMigrations) {
      await applyHistoricalMigration(sql, migration);
      console.log(`Applied missing historical migration: ${migration.tag}.`);
    }
  } finally {
    await sql.end();
  }
}

await adoptMigrationHistory();
