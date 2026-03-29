import { invoke } from "@tauri-apps/api/core";
import type { Entry } from "../../types/entry";

export async function createEntry(text: string): Promise<string> {
  return invoke<string>("create_entry", { text });
}

export async function restoreEntry(
  id: string,
  text: string,
  created_at: string
): Promise<string> {
  return invoke<string>("restore_entry", { id, text, createdAt: created_at });
}

export async function updateEntry(entryId: string, text: string): Promise<void> {
  return invoke("update_entry", { entryId, text });
}

export function generateEmbedding(entryId: string): void {
  invoke("generate_embedding", { entryId }).catch(() => {});
}

export async function findSimilarEntries(
  entryId: string,
  limit = 5
): Promise<Entry[]> {
  return invoke<Entry[]>("find_similar_entries", { entryId, limit });
}

export type Resurfaced = {
  entry: Entry;
  reason: string;
};

export async function getResurfacedEntry(
  excludeIds: string[] = []
): Promise<Resurfaced | null> {
  return invoke<Resurfaced | null>("get_resurfaced_entry", {
    excludeIds,
  });
}

export async function listEntries(): Promise<Entry[]> {
  return invoke<Entry[]>("list_entries");
}

export async function getEntry(entryId: string): Promise<Entry | null> {
  return invoke<Entry | null>("get_entry", { entryId });
}

export async function searchEntries(query: string): Promise<Entry[]> {
  return invoke<Entry[]>("search_entries", { query });
}

export async function jumpDatesInMonth(
  year: number,
  month: number
): Promise<string[]> {
  return invoke<string[]>("jump_dates_in_month", { year, month });
}

export async function jumpAnchorForLocalDate(
  localDate: string
): Promise<string | null> {
  return invoke<string | null>("jump_anchor_for_local_date", { localDate });
}

export async function getThoughtTrail(entryId: string): Promise<Entry[]> {
  return invoke<Entry[]>("get_thought_trail", { entryId });
}

export async function pinEntry(entryId: string): Promise<void> {
  return invoke("pin_entry", { entryId });
}

export async function unpinEntry(entryId: string): Promise<void> {
  return invoke("unpin_entry", { entryId });
}

export async function getPinnedEntryIds(): Promise<string[]> {
  return invoke<string[]>("get_pinned_entry_ids");
}

export function recordEntryOpen(entryId: string): void {
  invoke("record_entry_open", { entryId }).catch(() => {});
}

export async function deleteEntry(entryId: string): Promise<void> {
  return invoke("delete_entry", { entryId });
}

/** Wipes all entries (and pins/embeddings). Used by dev/debug UI only. */
export async function deleteAllEntries(): Promise<void> {
  return invoke("delete_all_entries", {});
}

/** Firestore pull ingest (SYNC.md). Returns count of newly inserted rows. */
export async function ingestFirestoreEntries(
  entries: { id: string; text: string; createdAt: string }[]
): Promise<number> {
  return invoke<number>("ingest_firestore_entries", { entries });
}

/** Sync v2: queue `{ op: "tombstone", entryId }` for Firestore flush (coalesced in SQLite). */
export async function enqueueSyncTombstone(entryId: string): Promise<void> {
  return invoke("enqueue_sync_tombstone", { entryId });
}

export async function listSyncTombstoneOutbox(): Promise<string[]> {
  return invoke<string[]>("list_sync_tombstone_outbox");
}

export async function removeSyncTombstoneOutbox(entryId: string): Promise<void> {
  return invoke("remove_sync_tombstone_outbox", { entryId });
}

export async function clearFirestoreIngestSuppression(entryId: string): Promise<void> {
  return invoke("clear_firestore_ingest_suppression", { entryId });
}

/** Physically delete local rows for remote tombstones (no new suppression). */
export async function deleteLocalEntriesForSync(entryIds: string[]): Promise<number> {
  if (entryIds.length === 0) {
    return 0;
  }
  return invoke<number>("delete_local_entries_for_sync", { entryIds });
}
