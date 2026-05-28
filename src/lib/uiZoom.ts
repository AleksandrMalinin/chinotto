const STORAGE_KEY = "chinotto.uiZoom";

export const UI_ZOOM_DEFAULT = 1;
/** Webview zoom; max above ~1.15 breaks header flex (space lens) on ~800px windows. */
export const UI_ZOOM_MIN = 0.85;
export const UI_ZOOM_MAX = 1.15;
export const UI_ZOOM_STEP = 0.05;

function storage(): Storage | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

export function clampUiZoom(scale: number): number {
  const rounded = Math.round(scale * 100) / 100;
  return Math.min(UI_ZOOM_MAX, Math.max(UI_ZOOM_MIN, rounded));
}

export function readStoredUiZoom(): number {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (raw == null) return UI_ZOOM_DEFAULT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return UI_ZOOM_DEFAULT;
  return clampUiZoom(n);
}

export function writeStoredUiZoom(scale: number): number {
  const clamped = clampUiZoom(scale);
  storage()?.setItem(STORAGE_KEY, String(clamped));
  return clamped;
}

export function stepUiZoom(current: number, direction: 1 | -1): number {
  return clampUiZoom(current + direction * UI_ZOOM_STEP);
}

export function isUiZoomInKey(e: KeyboardEvent): boolean {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return false;
  return e.key === "=" || e.key === "+" || e.code === "Equal";
}

export function isUiZoomOutKey(e: KeyboardEvent): boolean {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return false;
  return e.key === "-" || e.key === "_" || e.code === "Minus";
}

function isTauriShell(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function applyUiZoom(scale: number): Promise<number> {
  const clamped = writeStoredUiZoom(scale);
  if (!isTauriShell()) return clamped;
  const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  await getCurrentWebviewWindow().setZoom(clamped);
  return clamped;
}

export async function applyStoredUiZoom(): Promise<number> {
  return applyUiZoom(readStoredUiZoom());
}

export async function adjustUiZoom(direction: 1 | -1): Promise<number> {
  return applyUiZoom(stepUiZoom(readStoredUiZoom(), direction));
}
