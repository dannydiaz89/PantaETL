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
import {
  createPipelineRun as createPersistedPipelineRun,
  type CreatedPipelineRun,
  type PipelineRunRequest,
  promoteQueuedPipelineRuns as promotePersistedQueuedPipelineRuns,
  type PromotedPipelineRun,
} from "./run-queue.js";

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
 * ETL execution remains outside the scheduler boundary.
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

  /** Persist one trigger occurrence and its initial Source work atomically. */
  async createPipelineRun(
    request: PipelineRunRequest,
    now: Date = new Date(),
  ): Promise<CreatedPipelineRun> {
    return createPersistedPipelineRun(this.database.db, request, now);
  }

  /** Advance completed pipelines to their next queued run without executing it. */
  async promoteQueuedPipelineRuns(now: Date = new Date(), limit?: number): Promise<readonly PromotedPipelineRun[]> {
    return promotePersistedQueuedPipelineRuns(this.database.db, now, limit);
  }

  /** Release scheduler-owned database connections during service shutdown. */
  async stop(): Promise<void> {
    await this.database.close();
  }
}
