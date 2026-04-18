/**
 * Dev-only: show the empty-stream onboarding UI without deleting data.
 * refresh() skips loading entries while this is on. PROD always false.
 */

const STORAGE_KEY = "chinotto-dev-preview-empty-stream";

export function getDevPreviewEmptyStream(): boolean {
  if (import.meta.env.PROD) return false;
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function setDevPreviewEmptyStream(on: boolean): void {
  if (import.meta.env.PROD) return;
  if (typeof localStorage === "undefined") return;
  if (on) {
    localStorage.setItem(STORAGE_KEY, "1");
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}
