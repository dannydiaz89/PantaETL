import { and, asc, eq, lte, sql } from "drizzle-orm";

import type { DatabaseClient } from "./client.js";
import { jobs } from "./schema/execution.js";

/** A claimed job together with the metadata assigned by the claim transaction. */
export type ClaimedJob = typeof jobs.$inferSelect;

/**
 * Claims the next eligible job for one worker in a short database transaction.
 *
 * The row lock is released before returning, so callers must execute ETL work
 * outside this function and use separate state transitions for completion.
 */
export async function claimNextJob(
  db: DatabaseClient,
  workerId: string,
  now: Date = new Date(),
): Promise<ClaimedJob | undefined> {
  return db.transaction(async (transaction) => {
    const [candidate] = await transaction
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.state, "queued"), lte(jobs.availableAt, now)))
      .orderBy(asc(jobs.availableAt), asc(jobs.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });

    if (candidate === undefined) {
      return undefined;
    }

    const [claimedJob] = await transaction
      .update(jobs)
      .set({
        state: "running",
        workerId,
        claimedAt: now,
        heartbeatAt: now,
        attempt: sql`${jobs.attempt} + 1`,
      })
      .where(and(eq(jobs.id, candidate.id), eq(jobs.state, "queued")))
      .returning();

    return claimedJob;
  });
}
