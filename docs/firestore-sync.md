# Firestore sync (desktop)

**Contract:** **`chinotto-mobile/docs/SYNC.md`**. **Tombstones, queue, suppression, product scope:** **`docs/sync-deletion-v2.md`**.

Desktop: **bidirectional** sync — **pull** (`onSnapshot` + SQLite ingest), **push** on local create/restore (`setDoc` + merge with `text`, `createdAt` as `Timestamp`, `deletedAt` cleared via `deleteField`), **tombstone flush** (`setDoc` + merge with `deletedAt: serverTimestamp()`).

---

## Configuration

| Variable | Notes |
|----------|--------|
| `VITE_FIREBASE_API_KEY` | Required |
| `VITE_FIREBASE_PROJECT_ID` | Required |
| `VITE_FIREBASE_AUTH_DOMAIN` | Optional; defaults to `{projectId}.firebaseapp.com` |
| `VITE_FIREBASE_APP_ID` | Recommended |
| `VITE_FIREBASE_STORAGE_BUCKET` | Optional |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Optional |

Use the same Firebase Web app as mobile (`EXPO_PUBLIC_*` there → `VITE_*` here).

---

## OAuth and dev

- **Sync modal:** **Continue with Apple** uses a secondary window (release) or **default browser** (dev); credential returns to the main window via Tauri.
- **Dev:** Redirect often fails inside the auxiliary WKWebView; the app opens the **default browser** at `/chinotto-oauth?…`. Safari may require a tap on the bridge page before Apple opens. Dev bridge uses **`127.0.0.1`** POST; add **`localhost`** / **`127.0.0.1`** to Firebase **Authorized domains**.

## Firebase Hosting (OAuth)

The SDK loads **`https://{authDomain}/__/firebase/init.json`**. **404** there means Hosting not deployed — run `firebase deploy --only hosting` once for the project.

---

## Desktop listener behavior (summary)

When signed in (non-anonymous):

1. **Ingest:** `orderBy('createdAt','desc')`, `limit(500)` → `ingest_firestore_entries` for active-shaped docs; partition uses `deletedAt` for deletes in-window.
2. **Tombstones:** Second `onSnapshot` on `deletedAt != null` + **`orderBy('deletedAt','desc')`** + `limit(1000)` — **all returned doc ids** are applied as local deletes (query is source of truth).
3. **`getDocs`** on the same tombstone query: on sign-in, **every ingest snapshot** (forced), and **~12s** while signed in — backs up real-time listeners in WKWebView.
4. **`lastTombstoneQueryDocIds`:** ids from the latest tombstone read; **ingest skips** inserting those ids so stale snapshots do not resurrect tombstoned rows.
5. **Local delete:** `delete_entry` + suppression → **`notifyEntryDeletedForSync`** → outbox + flush.
6. **`delete_all_entries`:** clears entries, suppressions, tombstone outbox.

**Index:** Composite index for `deletedAt != null` + `orderBy('deletedAt','desc')` — use the URL from console errors if the app logs **`[chinotto sync] tombstone snapshot error`** or **`tombstone getDocs failed`**.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| **404** `init.json` on `{project}.firebaseapp.com` | Deploy Firebase Hosting. |
| **400** `createAuthUri` | API key / Identity Toolkit; Apple provider; authorized domains. |
| Blank OAuth / config errors | `VITE_FIREBASE_APP_ID` matches Web app; `authDomain` correct. |
| **`[chinotto sync] tombstone snapshot error` / `tombstone getDocs failed`** | Missing Firestore **composite index** (link in error). |
| **`[chinotto sync] tombstone apply failed`** | Often **IPC shape**: command expects top-level **`entryIds`**, not nested `args`. See **`docs/sync-deletion-v2.md`** Desktop → IPC. |
| **`[ChinottoSync] tombstone flush failed`** + **`database is locked`** | **Mobile** SQLite contention — see **`docs/sync-deletion-v2.md`** Mobile → SQLite lock. |

## Firebase Console

Enable **Apple** under Authentication; authorize domains used by the app.

## Implementation files

`firebaseConfig.ts`, `firestoreTombstone.ts`, `desktopFirestoreSync.ts`, `entryApi.ts`, `SyncModal.tsx`, `useAppleSyncOAuth.ts`, `OAuthBridge.tsx`, `main.tsx`; Tauri: `get_entry`, ingest, tombstone outbox, `delete_local_entries_for_sync`, `clear_firestore_ingest_suppression`; schema `sync_tombstone_outbox`, `firestore_ingest_suppressed_ids`.
