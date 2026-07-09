import type { EntryTheme } from "@/features/entries/entryApi";
import type { DocumentData } from "firebase/firestore";

/** Optional `theme` field on `users/{uid}/entries/{entryId}`. */
export type FirestoreEntryThemeWire = {
  themeId: string;
  locked: boolean;
  source: string;
  confidence: number;
};

export type FirestoreUserThemeWire = {
  id: string;
  label: string;
  sortOrder: number;
};

export function toFirestoreEntryThemeWire(theme: EntryTheme): FirestoreEntryThemeWire {
  return {
    themeId: theme.themeId,
    locked: theme.locked,
    source: theme.source,
    confidence: theme.confidence,
  };
}

export function parseFirestoreEntryTheme(value: unknown): EntryTheme | null {
  if (value == null || typeof value !== "object") {
    return null;
  }
  const o = value as Record<string, unknown>;
  const themeId = typeof o.themeId === "string" ? o.themeId.trim() : "";
  if (!themeId) {
    return null;
  }
  return {
    themeId,
    locked: o.locked === true,
    source: typeof o.source === "string" ? o.source : "manual",
    confidence: typeof o.confidence === "number" ? o.confidence : 1,
  };
}

export function parseEntryThemeField(data: DocumentData): EntryTheme | null | undefined {
  if (!("theme" in data)) {
    return undefined;
  }
  if (data.theme === null) {
    return null;
  }
  return parseFirestoreEntryTheme(data.theme);
}

export function partitionUserThemeDocs(
  docs: { id: string; data: () => DocumentData }[]
): { tombstonedIds: string[]; activeRows: FirestoreUserThemeWire[] } {
  const tombstonedIds: string[] = [];
  const activeRows: FirestoreUserThemeWire[] = [];
  for (const d of docs) {
    const data = d.data();
    if (data.deletedAt != null) {
      tombstonedIds.push(d.id);
      continue;
    }
    const label = typeof data.label === "string" ? data.label.trim() : "";
    if (!label) {
      continue;
    }
    const sortOrder = typeof data.sortOrder === "number" ? data.sortOrder : 0;
    activeRows.push({ id: d.id, label, sortOrder });
  }
  return { tombstonedIds, activeRows };
}

export const USER_THEME_QUERY_LIMIT = 100;
