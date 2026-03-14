/**
 * Resurface session and cooldown logic. Pure where possible for testability.
 * Used by App to decide when to attempt resurfacing and to pass cooldown IDs to the backend.
 */

export const RESURFACED_HISTORY_KEY = "chinotto-resurfaced-history";
export const RESURFACED_COOLDOWN_DAYS = 7;
export const RESURFACED_HISTORY_MAX = 50;

export type ResurfacedRecord = { id: string; shownAt: string };

export interface ResurfaceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): ResurfaceStorage {
  if (typeof localStorage === "undefined") {
    return { getItem: () => null, setItem: () => {} };
  }
  return localStorage;
}

export function getResurfacedHistory(
  storage: ResurfaceStorage = defaultStorage()
): ResurfacedRecord[] {
  try {
    const raw = storage.getItem(RESURFACED_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is ResurfacedRecord =>
        typeof x === "object" && x !== null && "id" in x && "shownAt" in x
    );
  } catch {
    return [];
  }
}

/** Entry IDs still in cooldown (shown within last `cooldownDays`). */
export function getIdsInCooldown(
  storage: ResurfaceStorage = defaultStorage(),
  cooldownDays: number = RESURFACED_COOLDOWN_DAYS
): string[] {
  const history = getResurfacedHistory(storage);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - cooldownDays);
  const cutoffMs = cutoff.getTime();
  return history
    .filter((r) => new Date(r.shownAt).getTime() >= cutoffMs)
    .map((r) => r.id);
}

export function markAsShown(
  id: string,
  storage: ResurfaceStorage = defaultStorage(),
  max: number = RESURFACED_HISTORY_MAX
): void {
  const history = getResurfacedHistory(storage);
  const next = [
    { id, shownAt: new Date().toISOString() },
    ...history.filter((r) => r.id !== id),
  ].slice(0, max);
  try {
    storage.setItem(RESURFACED_HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/** Guards for "may we run the resurface effect (and call tryResurface)?" */
export interface ResurfaceEffectGuards {
  introDismissed: boolean;
  selectedEntry: unknown;
  loading: boolean;
  searchTrimmed: boolean;
  isSearchOpen: boolean;
  editingEntryId: string | null;
  triedResurface: boolean;
}

/** True when the app may attempt resurfacing (effect should run). Resurfacing only on app open when these hold. */
export function mayAttemptResurface(guards: ResurfaceEffectGuards): boolean {
  return (
    guards.introDismissed &&
    guards.selectedEntry === null &&
    !guards.loading &&
    guards.searchTrimmed &&
    !guards.isSearchOpen &&
    guards.editingEntryId === null &&
    !guards.triedResurface
  );
}

/** True when tryResurface would actually call the backend. At most one per session. */
export function shouldInvokeBackend(
  shownThisSession: boolean,
  resurfaceInFlight: boolean
): boolean {
  return !shownThisSession && !resurfaceInFlight;
}
