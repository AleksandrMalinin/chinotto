import { enqueueAllLocalUserThemesForSync, listEntryIdsWithThemes } from "./themeSyncApi";
import { pushEntryThemeToRemote } from "./entryThemePush";
import { flushSyncUserThemeOutbox } from "./userThemeFlush";

/** One-shot after sync enable: upload local theme catalog and entry theme assignments. */
export async function backfillLocalThemesToRemote(): Promise<void> {
  await enqueueAllLocalUserThemesForSync();
  await flushSyncUserThemeOutbox();
  const entryIds = await listEntryIdsWithThemes();
  for (const entryId of entryIds) {
    try {
      await pushEntryThemeToRemote(entryId);
    } catch {
      /* retry on next entry push or theme assign */
    }
  }
}
