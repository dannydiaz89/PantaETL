import { z } from "zod";

/** Runtime validator for ISO 8601 timestamps with an explicit offset. */
export const timestampSchema = z.iso.datetime({ offset: true });
export type Timestamp = z.infer<typeof timestampSchema>;

/** Runtime validator for major wire-version identifiers such as `v1`. */
export const versionSchema = z.string().regex(/^v\d+$/);
export type Version = z.infer<typeof versionSchema>;
