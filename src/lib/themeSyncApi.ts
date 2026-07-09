import { invoke } from "@tauri-apps/api/core";

import type { EntryTheme } from "@/features/entries/entryApi";

export type UserThemeOutboxRow = {
  themeId: string;
  op: "upsert" | "tombstone";
  label: string | null;
  sortOrder: number | null;
};

export async function applyRemoteEntryTheme(
  entryId: string,
  theme: EntryTheme | null | undefined
): Promise<boolean> {
  if (theme === undefined) {
    return false;
  }
  return invoke<boolean>("apply_remote_entry_theme", {
    input: {
      entryId,
      theme:
        theme == null
          ? null
          : {
              themeId: theme.themeId,
              confidence: theme.confidence,
              source: theme.source,
              locked: theme.locked,
            },
    },
  });
}

export async function ingestRemoteUserThemes(
  rows: { id: string; label: string; sortOrder: number }[]
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }
  return invoke<number>("ingest_remote_user_themes", {
    rows: rows.map((r) => ({
      id: r.id,
      label: r.label,
      sortOrder: r.sortOrder,
    })),
  });
}

export async function applyRemoteUserThemeTombstones(themeIds: string[]): Promise<number> {
  if (themeIds.length === 0) {
    return 0;
  }
  return invoke<number>("apply_remote_user_theme_tombstones", { themeIds });
}

export async function listSyncUserThemeOutbox(): Promise<UserThemeOutboxRow[]> {
  return invoke<UserThemeOutboxRow[]>("list_sync_user_theme_outbox");
}

export async function removeSyncUserThemeOutbox(themeId: string): Promise<void> {
  return invoke("remove_sync_user_theme_outbox", { themeId });
}

export async function clearSyncUserThemeOutboxAll(): Promise<void> {
  return invoke("clear_sync_user_theme_outbox_all");
}

export async function clearUserThemeIngestSuppression(themeId: string): Promise<void> {
  return invoke("clear_user_theme_ingest_suppression", { themeId });
}

export async function enqueueAllLocalUserThemesForSync(): Promise<void> {
  return invoke("enqueue_all_local_user_themes_for_sync");
}

export async function listEntryIdsWithThemes(): Promise<string[]> {
  return invoke<string[]>("list_entry_ids_with_themes");
}
