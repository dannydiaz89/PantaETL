import { describe, expect, it } from "vitest";

import { createDatabaseConnection } from "../src/index.js";

describe("createDatabaseConnection", () => {
  it("creates a lazily connected PostgreSQL client", async () => {
    const connection = createDatabaseConnection("postgresql://pantaetl:pantaetl-dev@localhost:5432/pantaetl");

    expect(connection.db).toBeDefined();
    expect(connection.sql).toBeDefined();

    await connection.close();
  });

  it.each(["", "  ", "https://example.test/database", "not a URL"])(
    "rejects an invalid PostgreSQL connection URL: %j",
    (databaseUrl) => {
      expect(() => createDatabaseConnection(databaseUrl)).toThrow();
    },
  );
});
