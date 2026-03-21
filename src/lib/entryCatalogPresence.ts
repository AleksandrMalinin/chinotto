import type { Entry } from "@/types/entry";

/**
 * After `listEntries` / `listEntries("")` — authoritative "database has at least one entry".
 */
export function hasEntriesAfterFullListLoad(entryCount: number): boolean {
  return entryCount > 0;
}

/**
 * When the current `entries` slice becomes empty after a row delete animation, resync from DB.
 * `remainingInCurrentView` is the length after filtering (search results or full list).
 */
export async function resolveHasEntriesInDbAfterDeletion(input: {
  remainingInCurrentView: number;
  isDevSimulateNewUser: boolean;
  listEntries: () => Promise<Entry[]>;
}): Promise<boolean> {
  if (input.remainingInCurrentView > 0) {
    return true;
  }
  if (input.isDevSimulateNewUser) {
    return false;
  }
  const full = await input.listEntries();
  return full.length > 0;
}

/**
 * Whether the inline ⌘K search control should render.
 * With no active overlay query, `entries` is the full list from `listEntries`.
 * With a non-empty query, `entries` is FTS hits only; use `hasEntriesInDb` from the last full refresh.
 */
export function shouldShowSearchTrigger(options: {
  searchQueryActive: boolean;
  entriesLength: number;
  hasEntriesInDb: boolean;
}): boolean {
  return !options.searchQueryActive
    ? options.entriesLength > 0
    : options.hasEntriesInDb;
}
