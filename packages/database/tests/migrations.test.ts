import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const migrationsDirectory = fileURLToPath(new URL("../drizzle/", import.meta.url));

describe("committed migrations", () => {
  it("has a journal entry and executable SQL for every committed migration", () => {
    const journal = JSON.parse(readFileSync(`${migrationsDirectory}meta/_journal.json`, "utf8")) as {
      entries: { idx: number }[];
    };
    const files = readdirSync(migrationsDirectory).filter((file) => /^\d{4}_.+\.sql$/.test(file));

    expect(files).toHaveLength(journal.entries.length);
    for (const file of files) expect(readFileSync(`${migrationsDirectory}${file}`, "utf8").trim()).not.toBe("");
  });
});
