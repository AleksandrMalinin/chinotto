/** Minimum confidence to show a theme label in entry detail meta. */
export const THEME_META_THRESHOLD = 0.85;

/** Minimum themed entries before a search chip appears. */
export const THEME_CHIP_MIN_COUNT = 5;

export const ENTRY_THEMES = [
  { id: "links", label: "Links" },
  { id: "book", label: "Book" },
  { id: "therapy", label: "Therapy" },
] as const;

export type EntryThemeId = (typeof ENTRY_THEMES)[number]["id"];

export function themeLabel(themeId: string): string {
  return ENTRY_THEMES.find((t) => t.id === themeId)?.label ?? themeId;
}

export function shouldShowThemeInMeta(
  confidence: number,
  locked: boolean
): boolean {
  return locked || confidence >= THEME_META_THRESHOLD;
}
