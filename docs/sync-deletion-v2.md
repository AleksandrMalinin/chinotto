# Sync v2: Firestore sync and cross-device deletion

**Status:** Contract locked. Phase 2 (bidirectional **create** + **tombstone delete**) is **shipped** on **desktop** (`chinotto-app`) and **mobile** (`chinotto-mobile`). **Normative cross-repo copy:** **`chinotto-mobile/docs/SYNC.md`** (especially §8). Keep that section aligned with this file.

---

## Product scope

Applies to **both** desktop and mobile for the **same Firebase Auth `uid`**.

| In scope | Behavior |
|----------|----------|
| **Create** | New thoughts sync across devices via shared entry `id` and `users/{uid}/entries/{id}` in Firestore. |
| **Delete** | **`deletedAt`** tombstone (`Timestamp`, **`serverTimestamp()`** on write); **physical** local delete when a remote tombstone is applied. |

**Out of scope (this phase):** cross-device **edit** sync, edit conflict resolution, merge semantics for divergent `text` on the same `id`.

**Why:** Chinotto is capture-first; create/delete are the lifecycle users expect to sync. Edit sync needs conflict rules and is not required for a credible v2.

**Revisit edit sync** only if real usage shows meaningful pain.

**Other docs:** Desktop-only setup and troubleshooting → **`docs/firestore-sync.md`**.

---

## 1. `deletedAt` contract (final)

**Canonical type in Firestore:** **`Timestamp`** (JS SDK `Timestamp` / native equivalent on mobile).

**Rules:**

- Path: `users/{uid}/entries/{entryId}` → field **`deletedAt`**.
- **Absent** or **`null`** → **active**.
- **Non-null `Timestamp`** → **tombstoned** (gone from UX and stream logic).
- Writers use **`serverTimestamp()`** (or platform equivalent) for client-initiated tombstones. Do **not** store `deletedAt` as a plain ISO string **in Firestore**.

**SQLite:** No `deleted_at` column on `entries` for v2; local row is removed.

---

## 2. Local SQLite policy (final)

**Physically delete** the row from `entries` when a remote tombstone is applied (and on local user delete, as today). FTS / pins / embeddings follow existing triggers and FKs.

---

## 3. Delete ordering (final)

**Local delete first**, then enqueue remote tombstone.

1. **Local:** Remove row (and cascades); **during rollout** record **`firestore_ingest_suppressed_ids`** for that `entryId` where used as bridge.
2. **Queue:** Logical op **`{ op: "tombstone", entryId }`**; **coalesce** to one pending tombstone per `entryId` in durable storage (e.g. `sync_tombstone_outbox` on desktop).
3. **Async flush:** Firestore **`setDoc(ref, { deletedAt: serverTimestamp() }, { merge: true })`** (or equivalent). Merge avoids **`not-found`** when the remote doc never existed; idempotent if already tombstoned.

---

## 4. Sync queue contract — delete (minimal)

```json
{
  "op": "tombstone",
  "entryId": "<string, same as Firestore doc id and SQLite id>"
}
```

**No `deletedAt` in payload:** server time at flush only.

---

## 5. Suppression table rollout (final)

**Table (desktop):** `firestore_ingest_suppressed_ids`. **Mobile:** same idea where implemented.

| Phase | Behavior |
|-------|----------|
| **In use** | After local delete until tombstone flush **succeeds**; also while legacy clients exist without `deletedAt`. |
| **Later** | When all clients tombstone and apply tombstones, drop suppression from ingest logic and remove the table. |

**Invariant:** Ingest must not insert for an id that is **suppressed** or **remotely tombstoned**.

---

## Implementation checklist

1. Keep **`chinotto-mobile/docs/SYNC.md`** §8 aligned; Firestore rules must allow tombstone writes for the owning user.
2. Listeners / ingest: `deletedAt` set → physical local delete; else active ingest rules (respect suppression until sunset).
3. Delete path: local delete → enqueue → flush → clear suppression for that id on success.

---

## Desktop implementation (`chinotto-app`)

| Area | Notes |
|------|--------|
| **TS** | `firestoreTombstone.ts` — `isFirestoreDocumentTombstoned` (+ tests). `desktopFirestoreSync.ts` — auth, ingest + tombstone listeners, **`getDocs`** tombstone reconcile (on sign-in, **each ingest snapshot** with `force`, **~12s interval**), `lastTombstoneQueryDocIds` to skip re-ingest; tombstone listener applies **all doc ids** from the `deletedAt != null` query; **`pushEntryUpsertToFirestore`**, **`notifyEntryDeletedForSync`**, **`flushSyncTombstoneOutbox`** (`setDoc` + merge). |
| **SQLite / Rust** | `sync_tombstone_outbox`; `firestore_ingest_suppressed_ids`; `delete_local_entries_for_sync`, ingest/outbox commands. |
| **UI** | `App.tsx` — after create / restore push to Firestore; after delete `notifyEntryDeletedForSync`. `SyncModal.tsx` — copy. |
| **IPC** | Command **`delete_local_entries_for_sync`** takes **`entry_ids: Vec<String>`** only. Frontend: **`invoke('delete_local_entries_for_sync', { entryIds })`** (camelCase key matching Rust `entry_ids`). **Do not** wrap the array in a nested `args` object — that breaks deserialization. |

**Tombstone query:** `where('deletedAt','!=', null)` + **`orderBy('deletedAt','desc')`** + `limit(1000)` — **composite index** required (desktop and mobile).

---

## Mobile implementation (`chinotto-mobile`)

**Spec:** **`chinotto-mobile/docs/SYNC.md`** §4 / §8. Same path and `deletedAt` rules as above.

| Piece | Location (reference) |
|--------|----------------------|
| Tombstone detection | `sync/firestoreTombstone.ts` |
| Outbox + flush | `sync/tombstoneOutbox.ts`, `sync/tombstoneFlush.ts`, `sync/firebaseSync.ts` |
| Suppression | `sync/ingestSuppression.ts`, table `firestore_ingest_suppressed_ids` |
| Ingest + second listener | `sync/firestoreIngest.ts` — align tombstone query with desktop (`orderBy('deletedAt','desc')`) |
| Local delete / remote apply | `storage/entryRepository.ts` |

### SQLite lock on flush (`database is locked` / `finalizeAsync`)

**Mobile only** (Expo SQLite). Do not hold a DB transaction across **`await`** to Firestore; serialize writers; retry on `SQLITE_BUSY`.

---

## Summary

| Topic | Decision |
|--------|-----------|
| `deletedAt` | **`Timestamp`**, **`serverTimestamp()`** |
| Local row on remote tombstone | **Physical delete** |
| Delete order | **Local → enqueue → async Firestore tombstone** |
| Queue payload | **`{ op: "tombstone", entryId }`**, coalesced |
| Suppression | **Bridge until tombstone success + legacy sunset** |
| Flush to Firestore | **`setDoc` + `merge`** with `deletedAt` |
