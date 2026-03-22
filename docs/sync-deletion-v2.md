# Sync v2: deletion across devices (design)

**Normative product contract** remains in **`chinotto-mobile/docs/SYNC.md`**; this doc proposes the next phase for desktop + mobile alignment.

**Current v1:** mobile (and any writer) pushes creates to `users/{uid}/entries/{entryId}`; desktop **pulls** and **ingests** with `INSERT OR IGNORE`. Local delete on desktop does **not** update Firestore; **`firestore_ingest_suppressed_ids`** stops re-import while a stale remote doc still exists.

**Goal v2:** deleting a thought on **any** signed-in device should make that thought **disappear on all** devices (eventual consistency), without relying on suppression alone.

---

## Option 1: Hard delete in Firestore

**Mechanism:** On user delete locally → `deleteDoc` (or batched delete) on the same `entryId`. Other clients stop seeing the document in snapshots / queries.

| Criterion | Assessment |
|-----------|------------|
| **Fit with append-only ingest** | Poor as-is: v1 ingest assumes “remote adds rows”. v2 needs ingest to handle **removals** (snapshot `removed` / missing doc vs previous state) or query-only-active docs. Not append-only anymore. |
| **Reliability** | High when online: gone is unambiguous. Risk: **ordering** if SQLite delete happens before remote delete succeeds (ghost reappear) or remote deletes first and user loses undo buffer—needs a defined **outbox** (delete pending) or “delete remote first, then local” with rollback on failure. |
| **Offline** | Deletes must be **queued**; replay with retries. Firestore `deleteDoc` is idempotent on missing doc. Conflicts: offline edit on device B while device A queued delete—last writer wins unless tombstone/vector clock (out of scope). |
| **Retry semantics** | Simple: retry delete until success; safe if already deleted. |
| **Extensibility** | Weak for undo/audit/trash unless you add a separate collection or backups. |

---

## Option 2: Tombstone (soft delete)

**Mechanism:** Document **stays**; fields such as **`deletedAt`** (Firestore `Timestamp` or ISO string—**pick one in SYNC.md**) and optionally **`deletedByDeviceId`** later. Clients treat “visible thought” as `deletedAt == null`. Ingest **merges** updates into SQLite (update row or delete local row per product rule).

| Criterion | Assessment |
|-----------|------------|
| **Fit with v1 ingest** | Good: still “replicate document state”, not only inserts. Ingest becomes **upsert + tombstone apply** (hide or purge locally). Closer to Firestore’s merge/realtime model. |
| **Reliability** | Strong: same doc id always exists for idempotent **`updateDoc`**; no “missed delete” vs query cache edge cases as with hard delete + broad queries. |
| **Offline** | Queue **`set`/`update`** with `deletedAt`; merge when online. Same conflict caveats as hard delete for concurrent edits. |
| **Retry semantics** | Idempotent: setting `deletedAt` repeatedly is fine. |
| **Extensibility** | Strong: **undo** (clear `deletedAt` within window), trash UI, analytics, future multi-device attribution. |

---

## Recommendation

**Adopt Option 2 (tombstone) with a single canonical field:**

- **`deletedAt`**: `null` = active; non-null = deleted (server timestamp or client ISO, **one type chosen in SYNC.md**).

**Why not hard delete for v2**

- Local-first + offline queues are simpler to reason about with **mergeable writes** than with “document vanished”.
- Hard delete still requires **removal handling** in ingest/listeners (not just `INSERT OR IGNORE`), so complexity doesn’t disappear—it shifts to snapshot diffing and ordering.
- Tombstone matches Firestore patterns and leaves room for **undo** and **migration** from legacy docs without `deletedAt`.

**Optional later:** periodic **compaction** (hard delete or archive cold tombstones) — product decision, not required for v2 correctness.

---

## Required contract changes (`SYNC.md` + types)

1. **Document shape** under `users/{uid}/entries/{entryId}`  
   - Add **`deletedAt`**: `null | Timestamp` (or `null | string` ISO—**must match** mobile + desktop serializers).  
   - Do **not** require redundant `isDeleted` if `deletedAt` is the single source of truth.

2. **Visibility rule**  
   - **UI / list / search**: exclude entries where `deletedAt != null` (or hide locally after merge).

3. **Security rules**  
   - Owner may **create** and **update** own entry docs (including setting `deletedAt`).  
   - Clarify whether **hard delete** is allowed for compaction jobs only (admin) or disallowed for clients.

4. **Queries**  
   - Prefer client-side filter if query set stays small; or composite index + `where deletedAt == null` if you need server-side filtering at scale.

5. **Idempotency**  
   - Deletes: `updateDoc` setting `deletedAt` (same value or last-write-wins policy stated in SYNC).

---

## Mobile vs desktop behavior

| Action | Mobile | Desktop |
|--------|--------|---------|
| **User deletes thought** | Write **`deletedAt`** on Firestore doc (after or before local SQLite change per agreed ordering); handle offline queue. | Same. |
| **User creates thought** | Unchanged: create doc with `deletedAt: null`. | If desktop can create: same. |
| **Pull / listener** | Merge remote state: if `deletedAt` set → remove from local UI / delete or tombstone local row per **single local policy** in SYNC. | Same ingest path: **upsert** text/metadata or **delete local row** when remote tombstone seen. |
| **Legacy doc (no `deletedAt`)** | Treat as active (`deletedAt == null`). | Same. |

**Local SQLite policy (pick one in SYNC.md, both platforms same):**

- **A)** Keep row, add `deleted_at` column locally — easier audit; or  
- **B)** Delete row from `entries` when tombstone received — simpler list; **must** stop using suppression for that id once server tombstone is authoritative.

---

## `firestore_ingest_suppressed_ids` (current table)

| Phase | Role |
|-------|------|
| **During v2 rollout** | **Keep** as **fallback**: handles legacy Firestore docs still “active” after desktop-only delete (pre-v2), races before tombstone write succeeds, and any client that hasn’t shipped delete sync yet. |
| **After migration** | **Narrow or remove**: once every client writes **`deletedAt`** on delete and ingest honors tombstones, suppression is **mostly redundant**. Options: (1) stop writing new suppressions; (2) clear suppressions when ingest applies a matching remote tombstone; (3) remove table after telemetry shows no reliance. |

**Do not** rely on suppression as the **only** cross-device delete signal long term—it cannot propagate deletes **to** other devices.

---

## Implementation checklist (orientation)

1. Update **`SYNC.md`** (mobile repo): schema, ordering (local vs remote write), offline queue, conflict note.  
2. Mobile: delete path → Firestore **`deletedAt`**; listener → local merge.  
3. Desktop: Tauri command or reuse HTTP path to **write** tombstone; extend `desktopFirestoreSync` listener to handle tombstones (not only insert).  
4. SQLite: either local `deleted_at` or delete-on-tombstone + align FTS/pinned/embeddings behavior.  
5. Backfill: optional one-time script to set **`deletedAt`** for docs user deleted on desktop-only (if you can infer—often **not** possible; legacy stale docs remain until user deletes again or manual cleanup).  
6. Tests: offline queue replay, idempotent tombstone, “mobile deletes → desktop hides”, “desktop deletes → mobile hides”.

---

## Summary

- **v2 deletion model:** **Tombstone via `deletedAt`** on the existing entry document.  
- **Contract:** `SYNC.md` owns field types, visibility rules, and write ordering.  
- **Both platforms:** write tombstone on user delete; merge tombstones on pull/listener.  
- **Suppression table:** **temporary bridge**; keep through rollout, **deprecate** once tombstones are authoritative everywhere.
