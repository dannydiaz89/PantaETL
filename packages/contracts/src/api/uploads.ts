import { z } from "zod";

import { timestampSchema } from "../common/index.js";

/** Where an accepted file came to rest, and how long it survives without a pipeline claiming it. */
export interface SourceUploadResponse {
  /** The value a file-backed Source resolves, relative to the import directory. */
  readonly sourcePath: string;
  /** The name the file carried when it was supplied, for display only. */
  readonly fileName: string;
  /** The stored size in bytes. */
  readonly byteSize: number;
  /** When retention reclaims the file if no pipeline configuration references it. */
  readonly expiresAt: string;
}

/** Validate the staged-upload description returned to the pipeline builder. */
export const sourceUploadResponseSchema = z.strictObject({
  sourcePath: z.string().min(1),
  fileName: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  expiresAt: timestampSchema,
}) as z.ZodType<SourceUploadResponse>;
