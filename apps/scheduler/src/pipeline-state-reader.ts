import { pipelineStateSchema, type PipelineState } from "@pantaetl/contracts";
import type { DatabaseClient } from "@pantaetl/database";
import { pipelines } from "@pantaetl/database";
import { eq } from "drizzle-orm";

/** Reads the minimal persisted pipeline state needed by scheduler decisions. */
export interface PipelineStateReader {
  /** Return the current state for a pipeline, or undefined when it no longer exists. */
  findState(pipelineId: string): Promise<PipelineState | undefined>;
}

/** PostgreSQL implementation of the scheduler's read-only pipeline state boundary. */
export class DatabasePipelineStateReader implements PipelineStateReader {
  /** Creates a reader over the shared control-plane database client. */
  constructor(private readonly db: DatabaseClient) {}

  /** Fetch and validate one pipeline's state before the scheduler acts on it. */
  async findState(pipelineId: string): Promise<PipelineState | undefined> {
    const [pipeline] = await this.db
      .select({ state: pipelines.state })
      .from(pipelines)
      .where(eq(pipelines.id, pipelineId))
      .limit(1);

    if (!pipeline) {
      return undefined;
    }

    return pipelineStateSchema.parse(pipeline.state) as PipelineState;
  }
}
