# Firestore sync — architecture, status, and operations

**Repo:** `chinotto-app` (this file). **Release QA:** [sync-release-checklist.md](./sync-release-checklist.md) (mirror in `chinotto-mobile/docs/`).

**Normative wire contract (cross-repo):** `chinotto-mobile/docs/sync.md` — paths, field shapes, §8 tombstones, §4 module map. **Unlock / Enable sync UX:** `chinotto-mobile/docs/sync/cross-device-sync-unlock-flow.md`. When mobile’s contract changes, update this file’s **§ Cross-platform parity** and **§ Changelog**.

---

## How to maintain this document

| When | Do |
|------|-----|
| Sync **code** changes (ingest, tombstone, push, IPC) | Update **§ Desktop implementation** and **§ Runtime behavior**; add a **§ Changelog** row. |
| Mobile **`docs/sync.md`** changes | Diff §4/§8; refresh **§ Cross-platform parity** and mobile table below. |
| Preparing a release | Walk [sync-release-checklist.md](./sync-release-checklist.md) (P0 → P1 → P2). |

---

## Status summary

| Area | State |
|------|--------|
| **Phase 2** | **Shipped** on desktop when `VITE_FIREBASE_*` is set and the user signs in with Apple (non-anonymous). **Create** + **tombstone delete** across devices; **edit** not synced. |
| **Optional** | Core capture/search work **without** Firebase. |
| **Parity** | Desktop matches mobile on live **500** / tombstone **1000**, **post–sign-in backfill** (~20k actives), suppression + outbox, `createdAt` ingest shapes. |
| **Mobile** | Assumed shipped for the same Phase 2; see `chinotto-mobile/docs/sync.md`. |

---

## Product scope & contract

Applies to **both** apps for the **same Firebase Auth `uid`**.

| In scope | Behavior |
|----------|----------|
| **Create** | Shared entry `id`; Firestore path `users/{uid}/entries/{entryId}`. |
| **Delete** | Field **`deletedAt`**: **`Timestamp`**, written with **`serverTimestamp()`** on tombstone flush. **Absent** / **`null`** = active. **Physical** local `DELETE` when a remote tombstone applies. |

**Out of scope:** cross-device **edit** sync and conflict resolution. Revisit only if usage warrants.

### Delete ordering

1. **Local:** `DELETE` row (+ cascades); record **`firestore_ingest_suppressed_ids`** for that id until tombstone flush succeeds.  
2. **Queue:** `{ op: "tombstone", entryId }` coalesced in **`sync_tombstone_outbox`** (desktop).  
3. **Flush:** `setDoc(ref, { deletedAt: serverTimestamp() }, { merge: true })`. On success: remove outbox row + clear suppression.

**Invariant:** Ingest must not insert for an id that is **suppressed** or **remotely tombstoned**.

**Do not** store `deletedAt` as a plain ISO string **in Firestore**. **SQLite:** no `deleted_at` on `entries`; row removed.

### Firestore index (both clients)

Tombstone listener query: `deletedAt != null` + **`orderBy('deletedAt','desc')`** + `limit(1000)` → requires a **composite index** (console error includes a create link).

---

## Desktop implementation

### TypeScript

| Module | Role |
|--------|------|
| `src/lib/firebaseConfig.ts` | `VITE_FIREBASE_*` gate. |
| `src/lib/firestoreTombstone.ts` | `isFirestoreDocumentTombstoned` (+ tests). |
| `src/lib/desktopFirestoreSync.ts` | Auth, **backfill** (`getDocs`, `startAfter`, ≤40×500), live ingest + tombstone listeners, forced tombstone `getDocs` (sign-in, each ingest snapshot, ~12s poll), `lastTombstoneQueryDocIds`, push + tombstone flush; `subscribeDesktopSyncGateSession`, `subscribeChinottoUserSyncAccess` for sync modal gating. |
| `src/features/entries/entryApi.ts` | `invoke` wrappers; **`ingestFirestoreEntries`**; **`deleteLocalEntriesForSync`** → `{ entryIds }`. |
| `src/App.tsx` | `startDesktopFirestoreIngest`, push after create/restore, `notifyEntryDeletedForSync` on delete. |
| `src/features/entries/TrayCapturePanel.tsx` | Push after `createEntry` when sync on (menu bar surface). |
| `SyncModal.tsx`, `useAppleSyncOAuth.ts`, `OAuthBridge.tsx`, `main.tsx` | OAuth / UX. |

### Rust / SQLite

| Piece | Role |
|-------|------|
| `sync_tombstone_outbox` | Coalesced tombstone queue. |
| `firestore_ingest_suppressed_ids` | Bridge after local delete until flush. |
| `ingest_firestore_entries` | `INSERT OR IGNORE`; RFC3339 `created_at`; skips suppressed ids. |
| `get_entry` | Load row after create for Firestore push. |
| `delete_local_entries_for_sync` | Physical delete + clear suppression per id. |

### Desktop IPC (tombstone apply)

Command **`delete_local_entries_for_sync`** expects **top-level** `entryIds` (camelCase → Rust `entry_ids`). **Do not** nest under `args` — deserialization will fail and local rows won’t delete.

### Tests (this repo)

- Rust: `src-tauri/src/db/mod.rs` — ingest, suppression, outbox, delete-local.  
- Vitest: `firestoreTombstone.test.ts`, `desktopFirestoreSync.test.ts` (`createdAt` normalization).

### `createdAt` ingest (interop)

`normalizeFirestoreCreatedAtForIngest`: ISO string (typical from mobile), Firestore `Timestamp` (`toDate`), or plain `{ seconds, nanoseconds? }` → RFC3339 for Rust.

---

## Cross-platform parity

| Topic | Mobile | Desktop | Match |
|-------|--------|---------|--------|
| Phase 2 create + tombstone delete | Yes | Yes | Yes |
| Live active ingest | `limit(500)` | Same | Yes |
| Tombstone query | `limit(1000)`, `deletedAt` desc | Same | Yes |
| Active backfill after sign-in | ≤40 pages × 500 | Same | Yes |
| Suppression + outbox | Yes | Yes | Yes |
| `createdAt` | Often ISO on write | Push as `Timestamp`; ingest accepts ISO + Timestamp + seconds | Yes |
| Extra tombstone `getDocs` / poll | As needed | Forced + ~12s (WKWebView) | Intentional desktop-only reliability |

---

## Mobile reference (`chinotto-mobile`)

| Piece | Location (verify in mobile repo) |
|-------|-----------------------------------|
| Tombstone detection | `sync/firestoreTombstone.ts` |
| Outbox + flush | `sync/tombstoneOutbox.ts`, `tombstoneFlush.ts`, `firebaseSync.ts` |
| Suppression | `sync/ingestSuppression.ts` |
| Ingest + listeners | `sync/firestoreIngest.ts` |
| Local delete / apply | `storage/entryRepository.ts` |

**SQLite lock on flush (`database is locked`):** mobile only — do not hold a DB transaction across `await` to Firestore; serialize writers; retry on `SQLITE_BUSY`.

**QA:** `chinotto-mobile/docs/sync-apple-qa.md` (edge cases, two-device).

---

## Configuration (desktop)

| Variable | Notes |
|----------|--------|
| `VITE_FIREBASE_API_KEY` | Required |
| `VITE_FIREBASE_PROJECT_ID` | Required |
| `VITE_FIREBASE_AUTH_DOMAIN` | Optional; defaults `{projectId}.firebaseapp.com` |
| `VITE_FIREBASE_APP_ID` | Recommended |
| `VITE_FIREBASE_STORAGE_BUCKET` | Optional |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Optional |

Use the **same** Firebase Web app as mobile (`EXPO_PUBLIC_*` → `VITE_*`).

### QR bridge → mobile (always)

- **Header:** **Enable sync** opens `SyncModal` for every user (does not require `VITE_FIREBASE_*`).  
- **QR URL:** `https://getchinotto.app/sync` plus per-open **`?ds=<uuid-v4>`** for Firestore `sync_desktop_sessions` (contract: `chinotto-mobile/docs/sync/desktop-handoff-monetization-deeplinks.md`, `chinotto-mobile/docs/sync/sync.md` §3).  
- **Constant:** `CHINOTTO_SYNC_MOBILE_UNIVERSAL_LINK` in `src/components/SyncModal.tsx` — change there if the host/path changes (desktop still appends `ds`).  
- **Fallback:** “Open on your phone” copies the full URL (including `ds`); if clipboard fails, the same control becomes **Couldn’t copy — try again**.

### OAuth and dev (this Mac, when Firebase is configured)

- **Sync modal:** QR + Firestore gate; **Continue with Apple** is enabled only after mobile confirms unlock (`sync_desktop_sessions` or user taps **Already finished on your iPhone?**). **Sync is on** requires `users/{uid}.chinottoSyncAccess.active` from mobile, not Firebase sign-in alone.  
- **Path:** `/chinotto-oauth` (path-based routing survives redirects better than query-only).  
- **Dev:** Add **`localhost`** / **`127.0.0.1`** to Firebase **Authorized domains**.  
- **`init.json`:** `https://{authDomain}/__/firebase/init.json` — **404** means deploy Hosting once (`firebase deploy --only hosting`).

---

## Runtime behavior (desktop, signed in)

1. `flushSyncTombstoneOutbox` → forced tombstone **`getDocs`** → **backfill** (paginated `orderBy('createdAt','desc')`, 500/page, `startAfter`, max 40 pages) → then **`onSnapshot`** (ingest + tombstones). Aborted on sign-out / uid change before listeners attach.  
2. Live ingest: same query, `limit(500)` → `ingest_firestore_entries`.  
3. Tombstone listener: all doc ids from query → `delete_local_entries_for_sync`.  
4. Forced tombstone **`getDocs`** also on every ingest snapshot and ~**12s** interval.  
5. `lastTombstoneQueryDocIds` prevents stale ingest from resurrecting tombstoned rows.  
6. Local delete → `notifyEntryDeletedForSync` → outbox → flush.  
7. `delete_all_entries` clears entries, suppressions, outbox.

**Logs:** `[chinotto sync]` (desktop). `[ChinottoSync]` (mobile).

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| **404** `init.json` | Deploy Firebase Hosting. |
| **400** `createAuthUri` | API key / Apple provider / authorized domains. |
| Blank OAuth | `VITE_FIREBASE_APP_ID`, `authDomain`. |
| **`tombstone snapshot error` / `tombstone getDocs failed`** | Missing Firestore **composite index** (link in error). |
| **`tombstone apply failed`** | IPC: use **`entryIds`** at top level — see **§ Desktop IPC**. |
| **`database is locked`** on tombstone flush | **Mobile** — see **§ Mobile reference**. |

---

## Limits & explicit non-goals

| Limit | Detail |
|-------|--------|
| Backfill cap | ~**20k** newest actives by `createdAt`; extend pagination if needed. |
| Tombstone window | **1000** newest tombstones by `deletedAt`. |
| Edit sync | Not implemented. |
| Read cost | Backfill + forced tombstone reads per sign-in / snapshot; tradeoff for correctness and WKWebView reliability. |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-02 | **Docs:** Canonical **Enable sync / unlock** flow — `chinotto-mobile/docs/sync/cross-device-sync-unlock-flow.md` (desktop `SyncModal` states, `ds` gate, `chinottoSyncAccess`). |
| 2026-03-29 | **Docs:** Merged `sync-deletion-v2.md`, `sync-v2-as-built.md`, `sync-mobile-parity-and-followups.md`, and `firestore-sync.md` into this file. Release QA lives only in `sync-release-checklist.md`. |

*(Add a row when sync behavior or contract alignment changes materially.)*
