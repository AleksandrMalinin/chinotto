export const THEMES_ENABLED_KEY = "chinotto.themesEnabled";

function readFlag(key: string, defaultOn: boolean): boolean {
  try {
    if (typeof localStorage === "undefined") return defaultOn;
    const v = localStorage.getItem(key);
    if (v === null) return defaultOn;
    return v !== "0";
  } catch {
    return defaultOn;
  }
}

function writeFlag(key: string, enabled: boolean): void {
  try {
    localStorage.setItem(key, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function isThemesEnabled(): boolean {
  return readFlag(THEMES_ENABLED_KEY, true);
}

export function setThemesEnabled(enabled: boolean): void {
  writeFlag(THEMES_ENABLED_KEY, enabled);
}
