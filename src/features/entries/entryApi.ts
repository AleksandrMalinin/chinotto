import { invoke } from "@tauri-apps/api/core";
import type { Entry } from "../../types/entry";

export async function createEntry(text: string): Promise<string> {
  return invoke<string>("create_entry", { text });
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

export async function getResurfacedEntry(): Promise<Resurfaced | null> {
  return invoke<Resurfaced | null>("get_resurfaced_entry");
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
