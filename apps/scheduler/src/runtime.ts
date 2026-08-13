import type { DatabaseConnection } from "@pantaetl/database";

import {
  getPipelineSchedulingEligibility,
  type PipelineSchedulingEligibility,
} from "./pipeline-eligibility.js";
import {
  DatabasePipelineStateReader,
  type PipelineStateReader,
} from "./pipeline-state-reader.js";
import {
  claimDueSchedules as claimDueScheduleRecords,
  type ClaimedSchedule,
} from "./schedule-claims.js";

/** Health status exposed by the scheduler's lightweight service endpoint. */
export interface SchedulerHealth {
  readonly status: "ok" | "unavailable";
}

/** Pipeline-state decision returned without scheduling or execution side effects. */
export interface PipelineSchedulingStatus {
  readonly pipelineId: string;
  readonly eligibility: PipelineSchedulingEligibility | "missing";
}

/**
 * Owns the scheduler's database lifecycle and pre-scheduling checks.
 *
 * Schedule claiming, run creation, job enqueueing, and ETL execution deliberately
 * remain outside this foundation.
 */
export class SchedulerRuntime {
  private readonly pipelineStateReader: PipelineStateReader;

  /** Creates a scheduler runtime backed by the control-plane database. */
  constructor(private readonly database: DatabaseConnection, pipelineStateReader?: PipelineStateReader) {
    this.pipelineStateReader = pipelineStateReader ?? new DatabasePipelineStateReader(database.db);
  }

  /** Verify that the database is reachable without changing orchestration state. */
  async getHealth(): Promise<SchedulerHealth> {
    try {
      await this.database.sql`select 1`;
      return { status: "ok" };
    } catch {
      return { status: "unavailable" };
    }
  }

  /** Check a pipeline's persisted state before future scheduling work is introduced. */
  async getPipelineSchedulingStatus(pipelineId: string): Promise<PipelineSchedulingStatus> {
    const state = await this.pipelineStateReader.findState(pipelineId);

    if (state === undefined) {
      return { pipelineId, eligibility: "missing" };
    }

    return { pipelineId, eligibility: getPipelineSchedulingEligibility(state) };
  }

  /** Reserve overdue schedule occurrences without creating runs or executing pipeline work. */
  async claimDueSchedules(now: Date = new Date(), limit?: number): Promise<readonly ClaimedSchedule[]> {
    return claimDueScheduleRecords(this.database.db, now, limit);
  }

  /** Release scheduler-owned database connections during service shutdown. */
  async stop(): Promise<void> {
    await this.database.close();
  }
}
