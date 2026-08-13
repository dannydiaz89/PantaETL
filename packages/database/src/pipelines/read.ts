import { and, asc, eq, inArray } from "drizzle-orm";

import type { DatabaseClient } from "../client.js";
import { pipelineComponents, pipelineEdges, pipelines, pipelineTriggers } from "../schema/pipelines.js";
import { hydratePipeline, type PersistedPipelineGraph } from "./hydration.js";

/** Owner-scoped identity for a pipeline repository read. */
export interface GetPipelineInput {
  /** Pipeline identity supplied by the caller. */
  readonly pipelineId: string;
  /** Trusted authenticated owner used to scope the query. */
  readonly ownerUserId: string;
}

/**
 * Lists every pipeline owned by one authenticated user with its complete graph.
 *
 * The repository does not query connection secrets, so the returned canonical
 * contracts can contain only configuration values and binding references.
 */
export async function listPipelinesByOwner(
  db: DatabaseClient,
  ownerUserId: string,
): Promise<readonly ReturnType<typeof hydratePipeline>[]> {
  const pipelineRecords = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.ownerUserId, ownerUserId))
    .orderBy(asc(pipelines.createdAt), asc(pipelines.id));

  if (pipelineRecords.length === 0) {
    return [];
  }

  const pipelineIds = pipelineRecords.map((pipeline) => pipeline.id);
  const [components, edges, triggers] = await Promise.all([
    db.select().from(pipelineComponents).where(inArray(pipelineComponents.pipelineId, pipelineIds)),
    db.select().from(pipelineEdges).where(inArray(pipelineEdges.pipelineId, pipelineIds)),
    db.select().from(pipelineTriggers).where(inArray(pipelineTriggers.pipelineId, pipelineIds)),
  ]);

  return pipelineRecords.map((pipeline) =>
    hydratePipeline({
      components: components.filter((component) => component.pipelineId === pipeline.id),
      edges: edges.filter((edge) => edge.pipelineId === pipeline.id),
      pipeline,
      triggers: triggers.filter((trigger) => trigger.pipelineId === pipeline.id),
    }),
  );
}

/**
 * Fetches one complete pipeline graph only when it belongs to the authenticated owner.
 *
 * An absent result deliberately makes unauthorized and nonexistent pipeline IDs
 * indistinguishable to callers outside the repository boundary.
 */
export async function getPipeline(
  db: DatabaseClient,
  input: GetPipelineInput,
): Promise<ReturnType<typeof hydratePipeline> | undefined> {
  const [pipeline] = await db
    .select()
    .from(pipelines)
    .where(andOwnerAndPipelineId(input))
    .limit(1);

  if (pipeline === undefined) {
    return undefined;
  }

  return hydratePipeline(await readPipelineGraph(db, pipeline));
}

/** Reads the child records required to hydrate an already owner-scoped pipeline. */
async function readPipelineGraph(
  db: DatabaseClient,
  pipeline: typeof pipelines.$inferSelect,
): Promise<PersistedPipelineGraph> {
  const [components, edges, triggers] = await Promise.all([
    db.select().from(pipelineComponents).where(eq(pipelineComponents.pipelineId, pipeline.id)),
    db.select().from(pipelineEdges).where(eq(pipelineEdges.pipelineId, pipeline.id)),
    db.select().from(pipelineTriggers).where(eq(pipelineTriggers.pipelineId, pipeline.id)),
  ]);

  return { components, edges, pipeline, triggers };
}

/** Builds the required owner-and-identity predicate for a protected pipeline read. */
function andOwnerAndPipelineId(input: GetPipelineInput) {
  return and(eq(pipelines.ownerUserId, input.ownerUserId), eq(pipelines.id, input.pipelineId));
}
