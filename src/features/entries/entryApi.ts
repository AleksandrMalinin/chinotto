import { invoke } from "@tauri-apps/api/core";
import type { Entry } from "../../types/entry";

export async function createEntry(text: string): Promise<void> {
  await invoke("create_entry", { text });
}

export async function listEntries(): Promise<Entry[]> {
  return invoke<Entry[]>("list_entries");
}

export async function searchEntries(query: string): Promise<Entry[]> {
  return invoke<Entry[]>("search_entries", { query });
}
