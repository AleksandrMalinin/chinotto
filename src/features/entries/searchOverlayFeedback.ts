import type { Entry } from "../../types/entry";

/**
 * Returns the search overlay feedback text for a given result set.
 * Used by the overlay and by tests.
 */
export function getSearchFeedback(entries: Entry[]): string {
  if (entries.length === 0) return "No entries found";
  if (entries.length === 1) return "1 result";
  return `${entries.length} results`;
}
