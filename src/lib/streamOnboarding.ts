/** Persists whether the user has saved at least one entry (used for “return to empty” soft onboarding). */
const STORAGE_KEY = "chinotto.hasEverSavedThought";

export function hasEverSavedThought(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setHasEverSavedThought(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore quota / private mode */
  }
}
