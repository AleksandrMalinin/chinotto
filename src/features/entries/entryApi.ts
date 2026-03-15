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

export async function searchEntries(query: string): Promise<Entry[]> {
  return invoke<Entry[]>("search_entries", { query });
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
