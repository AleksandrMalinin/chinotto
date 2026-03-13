/**
 * Sets the app dock/taskbar icon to the given variant (macOS dock, Windows/Linux taskbar).
 * Uses a Tauri command so macOS can change the dock icon via NSApplication.
 * No-op when not running inside Tauri (e.g. browser dev).
 */

import { invoke } from "@tauri-apps/api/core";
import { getIconVariant } from "./iconVariants";
import { variantToPngBytes } from "./iconToPng";

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function setDesktopIcon(variantId: string): Promise<void> {
  try {
    const variant = getIconVariant(variantId);
    const pngBytes = await variantToPngBytes(variant);
    const pngBase64 = uint8ArrayToBase64(pngBytes);
    await invoke("set_app_icon", { pngBase64 });
  } catch {
    /* Not in Tauri or command failed */
  }
}
