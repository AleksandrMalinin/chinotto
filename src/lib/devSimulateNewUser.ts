/**
 * Dev-only: simulate first-time / new-user state without touching real data.
 * Only active when import.meta.env.DEV is true. Not present in production builds.
 */

const STORAGE_KEY = "chinotto-dev-simulate-new-user";

export function getDevSimulateNewUser(): boolean {
  if (import.meta.env.PROD) return false;
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function setDevSimulateNewUser(on: boolean): void {
  if (import.meta.env.PROD) return;
  if (typeof localStorage === "undefined") return;
  if (on) {
    localStorage.setItem(STORAGE_KEY, "1");
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}
