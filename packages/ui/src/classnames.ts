/** Values supported by the design-system class name composer. */
export type ClassNameValue = string | false | null | undefined;

/** Combines optional class names without making consumers depend on a utility package. */
export function cx(...values: readonly ClassNameValue[]): string {
  return values.filter((value): value is string => typeof value === "string" && value.length > 0).join(" ");
}
