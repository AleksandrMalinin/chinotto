import { classifyEntryTheme, generateEmbedding } from "@/features/entries/entryApi";
import { pushEntryThemeToRemote } from "@/lib/entryThemePush";

/** After local SQLite text save: push merge to Firestore (when sync on) and refresh side indexes. */
export function syncSavedEntryTextToRemote(entryId: string): void {
  void pushEntryThemeToRemote(entryId);
  generateEmbedding(entryId);
  classifyEntryTheme(entryId);
}
