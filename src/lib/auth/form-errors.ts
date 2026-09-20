import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "@/lib/api/errors";

/**
 * Maps ApiError VALIDATION_FAILED details onto form fields.
 * Returns true when at least one field error was set.
 */
export function applyApiFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
  aliases: Record<string, string> = {},
): boolean {
  if (!(error instanceof ApiError)) return false;
  let applied = false;
  for (const d of error.fieldErrors) {
    const name = aliases[d.field] ?? d.field;
    if (fields.includes(name)) {
      setError(name as Path<T>, { type: "server", message: d.message });
      applied = true;
    }
  }
  return applied;
}

export function isNetworkError(error: unknown) {
  return error instanceof ApiError && (error.status === 0 || error.code === "NETWORK_ERROR");
}
