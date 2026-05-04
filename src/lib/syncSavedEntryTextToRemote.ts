import { generateEmbedding, getEntry } from "@/features/entries/entryApi";
import { pushEntryUpsertToFirestore } from "@/lib/desktopFirestoreSync";

/** After local SQLite text save: push merge to Firestore (when sync on) and refresh embedding index. */
export function syncSavedEntryTextToRemote(entryId: string): void {
  void getEntry(entryId).then((row) => {
    if (row) void pushEntryUpsertToFirestore(row);
  });
  generateEmbedding(entryId);
}
