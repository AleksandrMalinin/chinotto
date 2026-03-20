/**
 * Whether the inline ⌘K search control should render.
 * With an empty overlay query, `entries` is the full list from `listEntries`.
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
