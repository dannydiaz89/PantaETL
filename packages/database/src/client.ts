import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { URL } from "node:url";
import postgres, { type Sql } from "postgres";

import * as schema from "./schema/index.js";

/** Type of the Drizzle client backed by the package's PostgreSQL schema. */
export type DatabaseClient = PostgresJsDatabase<typeof schema>;

/** A database client together with the connection lifecycle it owns. */
export interface DatabaseConnection {
  readonly db: DatabaseClient;
  readonly sql: Sql;
  close(): Promise<void>;
}

/**
 * Creates an unconnected PostgreSQL client for the provided connection URL.
 *
 * Connections are opened lazily by the driver when a query executes. Call `close`
 * when the owning service shuts down so pooled connections are released.
 */
export function createDatabaseConnection(databaseUrl: string): DatabaseConnection {
  const connectionUrl = validateDatabaseUrl(databaseUrl);
  const sql = postgres(connectionUrl);

  return {
    db: drizzle({ client: sql, schema }),
    sql,
    close: () => sql.end(),
  };
}

/** Validates that a connection URL uses a PostgreSQL scheme without exposing it. */
function validateDatabaseUrl(databaseUrl: string): string {
  const connectionUrl = databaseUrl.trim();

  if (connectionUrl.length === 0) {
    throw new Error("A PostgreSQL connection URL is required.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(connectionUrl);
  } catch {
    throw new Error("Database connection URL must be a valid URL.");
  }

  if (parsedUrl.protocol !== "postgres:" && parsedUrl.protocol !== "postgresql:") {
    throw new Error("Database connection URL must use the postgres or postgresql scheme.");
  }

  return connectionUrl;
}
