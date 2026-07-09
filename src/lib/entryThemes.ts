/** Minimum confidence to show a theme label in entry detail meta. */
export const THEME_META_THRESHOLD = 0.85;

/** Minimum themed entries before a search chip appears. */
export const THEME_CHIP_MIN_COUNT = 5;

/** Max user-defined recall themes (system "links" is separate). */
export const MAX_USER_THEMES = 7;

export const SYSTEM_THEME_LINKS = "links";

export type UserTheme = {
  id: string;
  label: string;
  sort_order: number;
};

export function themeLabel(themeId: string, userThemes: UserTheme[]): string {
  if (themeId === SYSTEM_THEME_LINKS) {
    return "Links";
  }
  return userThemes.find((t) => t.id === themeId)?.label ?? themeId;
}

export function recallThemeOptions(userThemes: UserTheme[]): UserTheme[] {
  const sorted = [...userThemes].sort((a, b) => a.sort_order - b.sort_order);
  return sorted;
}

export function searchChipThemes(userThemes: UserTheme[]): { id: string; label: string }[] {
  return [
    { id: SYSTEM_THEME_LINKS, label: "Links" },
    ...recallThemeOptions(userThemes).map((t) => ({ id: t.id, label: t.label })),
  ];
}

export function shouldShowThemeInMeta(
  confidence: number,
  locked: boolean
): boolean {
  return locked || confidence >= THEME_META_THRESHOLD;
}
