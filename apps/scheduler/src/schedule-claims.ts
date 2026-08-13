import { CronExpressionParser } from "cron-parser";
import { and, asc, eq, isNotNull, lte } from "drizzle-orm";

import type { DatabaseClient } from "@pantaetl/database";
import { pipelineTriggers, pipelines } from "@pantaetl/database";

import { createPipelineRunInTransaction, type CreatedPipelineRun } from "./run-queue.js";

/** A due schedule occurrence reserved by one scheduler instance. */
export interface ClaimedSchedule {
  readonly cron: string;
  readonly nextRunAt: Date;
  readonly pipelineId: string;
  readonly scheduledFor: Date;
  readonly run: CreatedPipelineRun;
  readonly timezone: string;
  readonly triggerId: string;
}

/** The maximum number of overdue occurrences one scheduler pass may reserve. */
export const DEFAULT_SCHEDULE_CLAIM_LIMIT = 100;

/**
 * Calculates the first cron occurrence strictly after the supplied occurrence.
 *
 * Advancing from the prior scheduled time instead of the current clock preserves
 * every missed occurrence for later scheduler passes.
 */
export function calculateNextScheduleRun(cron: string, timezone: string, after: Date): Date {
  return CronExpressionParser.parse(cron, { currentDate: after, tz: timezone }).next().toDate();
}

/**
 * Claims due enabled schedules in a short row-locking transaction.
 *
 * Each claimed trigger advances by exactly one cron occurrence before the lock is
 * released. Concurrent schedulers therefore cannot reserve the same occurrence,
 * and overdue occurrences remain due until each has been claimed.
 */
export async function claimDueSchedules(
  db: DatabaseClient,
  now: Date = new Date(),
  limit: number = DEFAULT_SCHEDULE_CLAIM_LIMIT,
): Promise<readonly ClaimedSchedule[]> {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error("Schedule claim limit must be a positive safe integer.");
  }

  return db.transaction(async (transaction) => {
    const dueSchedules = await transaction
      .select({
        cron: pipelineTriggers.cron,
        nextRunAt: pipelineTriggers.nextRunAt,
        pipelineId: pipelineTriggers.pipelineId,
        timezone: pipelineTriggers.timezone,
        triggerId: pipelineTriggers.id,
      })
      .from(pipelineTriggers)
      .innerJoin(pipelines, eq(pipelineTriggers.pipelineId, pipelines.id))
      .where(
        and(
          eq(pipelineTriggers.type, "schedule"),
          eq(pipelineTriggers.enabled, true),
          eq(pipelines.state, "enabled"),
          isNotNull(pipelineTriggers.cron),
          isNotNull(pipelineTriggers.timezone),
          isNotNull(pipelineTriggers.nextRunAt),
          lte(pipelineTriggers.nextRunAt, now),
        ),
      )
      .orderBy(asc(pipelineTriggers.nextRunAt), asc(pipelineTriggers.id))
      .limit(limit)
      .for("update", { skipLocked: true });

    const claimedSchedules: ClaimedSchedule[] = [];

    for (const dueSchedule of dueSchedules) {
      const { cron, nextRunAt: scheduledFor, timezone } = dueSchedule;

      if (cron === null || scheduledFor === null || timezone === null) {
        throw new Error("Due schedule is missing required scheduling fields.");
      }

      const nextRunAt = calculateNextScheduleRun(
        cron,
        timezone,
        scheduledFor,
      );

      await transaction
        .update(pipelineTriggers)
        .set({ lastClaimedAt: now, nextRunAt })
        .where(eq(pipelineTriggers.id, dueSchedule.triggerId));
      const run = await createPipelineRunInTransaction(
        transaction,
        { pipelineId: dueSchedule.pipelineId, scheduledFor, triggerId: dueSchedule.triggerId },
        now,
      );

      claimedSchedules.push({
        cron,
        nextRunAt,
        pipelineId: dueSchedule.pipelineId,
        run,
        scheduledFor,
        timezone,
        triggerId: dueSchedule.triggerId,
      });
    }

    return claimedSchedules;
  });
}
