import { Timestamp, type DocumentData } from "firebase/firestore";

/**
 * Sync v2: remote entry is deleted when `deletedAt` is a Firestore Timestamp (or Timestamp-like).
 * Legacy docs omit the field → active.
 * Non-empty string `deletedAt` is treated as tombstoned for cross-client tolerance (contract prefers Timestamp).
 */
export function isFirestoreDocumentTombstoned(data: DocumentData): boolean {
  const v = data.deletedAt;
  if (v == null || v === false) {
    return false;
  }
  if (typeof v === "string" && v.trim().length > 0) {
    return true;
  }
  if (v instanceof Timestamp) {
    return true;
  }
  if (typeof v === "object" && v !== null && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
    return true;
  }
  if (typeof v === "object" && v !== null && "seconds" in v) {
    const s = (v as { seconds: unknown }).seconds;
    if (typeof s === "number" || typeof s === "bigint") {
      return true;
    }
  }
  return false;
}
