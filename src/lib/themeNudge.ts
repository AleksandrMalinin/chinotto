/**
 * Theme cluster nudge: session caps and per-theme dismiss cooldown.
 */

export const THEME_NUDGE_DISMISS_KEY = "chinotto-theme-nudge-dismiss";
export const THEME_NUDGE_COOLDOWN_DAYS = 14;
export const THEME_NUDGE_MIN_CLUSTER = 5;
export const THEME_NUDGE_CLUSTER_DAYS = 7;

export type ThemeNudgeDismiss = { themeId: string; dismissedAt: string };

export interface ThemeNudgeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): ThemeNudgeStorage {
  if (typeof localStorage === "undefined") {
    return { getItem: () => null, setItem: () => {} };
  }
  return localStorage;
}

export function getThemeNudgeDismissals(
  storage: ThemeNudgeStorage = defaultStorage()
): ThemeNudgeDismiss[] {
  try {
    const raw = storage.getItem(THEME_NUDGE_DISMISS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is ThemeNudgeDismiss =>
        typeof x === "object" &&
        x !== null &&
        "themeId" in x &&
        "dismissedAt" in x
    );
  } catch {
    return [];
  }
}

export function isThemeNudgeInCooldown(
  themeId: string,
  storage: ThemeNudgeStorage = defaultStorage(),
  cooldownDays: number = THEME_NUDGE_COOLDOWN_DAYS
): boolean {
  const record = getThemeNudgeDismissals(storage).find((r) => r.themeId === themeId);
  if (!record) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - cooldownDays);
  return new Date(record.dismissedAt).getTime() >= cutoff.getTime();
}

export function markThemeNudgeDismissed(
  themeId: string,
  storage: ThemeNudgeStorage = defaultStorage()
): void {
  const next = [
    { themeId, dismissedAt: new Date().toISOString() },
    ...getThemeNudgeDismissals(storage).filter((r) => r.themeId !== themeId),
  ].slice(0, 20);
  try {
    storage.setItem(THEME_NUDGE_DISMISS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export interface ThemeNudgeEffectGuards {
  themesEnabled: boolean;
  triedResurface: boolean;
  memoryEcho: boolean;
  introDismissed: boolean;
  selectedEntry: unknown;
  loading: boolean;
  searchTrimmed: boolean;
  isSearchOpen: boolean;
  composeExpanded: boolean;
  editingEntryId: string | null;
  triedThemeNudge: boolean;
}

export function mayAttemptThemeNudge(guards: ThemeNudgeEffectGuards): boolean {
  return (
    guards.themesEnabled &&
    guards.triedResurface &&
    !guards.memoryEcho &&
    guards.introDismissed &&
    guards.selectedEntry === null &&
    !guards.loading &&
    guards.searchTrimmed &&
    !guards.isSearchOpen &&
    !guards.composeExpanded &&
    guards.editingEntryId === null &&
    !guards.triedThemeNudge
  );
}

export function pickThemeNudgeCandidate(
  counts: readonly { themeId: string; count: number }[],
  storage: ThemeNudgeStorage = defaultStorage()
): { themeId: string; count: number } | null {
  const eligible = counts.filter(
    (c) =>
      c.count >= THEME_NUDGE_MIN_CLUSTER &&
      !isThemeNudgeInCooldown(c.themeId, storage)
  );
  if (eligible.length === 0) return null;
  return [...eligible].sort((a, b) => b.count - a.count)[0] ?? null;
}
