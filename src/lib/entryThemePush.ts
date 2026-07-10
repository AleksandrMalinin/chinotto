import { getEntry, getEntryTheme } from "@/features/entries/entryApi";
import { isThemesEnabled } from "@/lib/themeSettings";
import { isFirebaseSyncConfigured } from "@/lib/firebaseConfig";

import { pushEntryUpsertToFirestore } from "./desktopFirestoreSync";

/**
 * Push current entry text + optional theme field after local theme assign/classify.
 * Best-effort; entry create/edit paths still cover text-only retries.
 */
export async function pushEntryThemeToRemote(entryId: string): Promise<void> {
  if (!isFirebaseSyncConfigured()) {
    return;
  }
  if (!isThemesEnabled()) {
    return;
  }
  const entry = await getEntry(entryId);
  if (entry == null) {
    return;
  }
  const theme = await getEntryTheme(entryId);
  await pushEntryUpsertToFirestore(entry, theme);
}

export function scheduleEntryThemePush(entryId: string): void {
  void pushEntryThemeToRemote(entryId);
}
