# Firestore sync — architecture, status, and operations

**Repo:** `chinotto-app` (this file). **Release QA:** [sync-release-checklist.md](./sync-release-checklist.md) (mirror: `chinotto-mobile/docs/sync/sync-release-checklist.md`).

**Normative wire contract (cross-repo):** `chinotto-mobile/docs/sync/sync.md` — paths, field shapes, §8 tombstones, §4 module map. **Unlock / Enable sync UX:** `chinotto-mobile/docs/sync/cross-device-sync-unlock-flow.md`. When mobile’s contract changes, update this file’s **§ Cross-platform parity** and **§ Changelog**.

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
| **Phase 2** | **Shipped** on desktop when `VITE_FIREBASE_*` is set and the user signs in with Apple (non-anonymous). **Create** + **tombstone delete** across devices. **Text edits:** desktop merges `text` + `updatedAt` to Firestore after local save; **mobile** must apply remote `text` changes to existing SQLite rows (see `chinotto-mobile/docs/sync/sync.md`). |
| **Optional** | Core capture/search work **without** Firebase. |
| **Parity** | Desktop matches mobile on live **500** / tombstone **1000**, **post–sign-in backfill** (~20k actives), suppression + outbox, `createdAt` ingest shapes. |
| **Mobile** | Assumed shipped for the same Phase 2; see `chinotto-mobile/docs/sync/sync.md`. |

---

## Product scope & contract

Applies to **both** apps for the **same Firebase Auth `uid`**.

**Account deletion on any client:** When the Firebase Auth user is deleted (per mobile account-deletion flow), `users/{uid}` and `users/{uid}/entries/*` are removed for that uid. Other signed-in clients must not assume that path still exists: treat lost Firestore access as end of cloud session, keep local SQLite entries, clear local sync queues, and stay local-only until the user signs in again (see desktop `invalidateFirebaseSyncAfterRemoteSessionLost`).

| In scope | Behavior |
|----------|----------|
| **Create** | Shared entry `id`; Firestore path `users/{uid}/entries/{entryId}`. |
| **Delete** | Field **`deletedAt`**: **`Timestamp`**, written with **`serverTimestamp()`** on tombstone flush. **Absent** / **`null`** = active. **Physical** local `DELETE` when a remote tombstone applies. |

**Out of scope:** **conflict resolution** when the same thought is edited on two devices before sync settles; **desktop Firestore ingest** still only **inserts** new ids (it does not overwrite local `text` from remote for an existing row). Revisit if full bidirectional merge-on-id is required.

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
| `src/lib/syncSavedEntryTextToRemote.ts` | After local `update_entry`: `getEntry` → `pushEntryUpsertToFirestore` + `generate_embedding`. |
| `src/features/entries/entryApi.ts` | `invoke` wrappers; **`ingestFirestoreEntries`**; **`deleteLocalEntriesForSync`** → `{ entryIds }`; **`clearSyncTombstoneOutboxAll`** after lost cloud session. |
| `src/App.tsx` | `startDesktopFirestoreIngest`, push after create/restore, `syncSavedEntryTextToRemote` after local text save (detail + stream late edit + unmount flush), `notifyEntryDeletedForSync` on delete. |
| `src/features/entries/TrayCapturePanel.tsx` | Push after `createEntry` when sync on (menu bar surface). |
| `SyncModal.tsx`, `useAppleSyncOAuth.ts`, `OAuthBridge.tsx`, `main.tsx` | OAuth / UX. |

### Rust / SQLite

| Piece | Role |
|-------|------|
| `sync_tombstone_outbox` | Coalesced tombstone queue; **`clear_sync_tombstone_outbox_all`** when Firebase session is invalidated. |
| `firestore_ingest_suppressed_ids` | Bridge after local delete until flush. |
| `ingest_firestore_entries` | `INSERT OR IGNORE` with `updated_at` (= `created_at` for new rows); RFC3339 `created_at`; skips suppressed ids. |
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

**GitHub Actions (`release.yml`):** add repository secrets with the same names (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, optional fields above) so tag/release builds embed sync config. Without them, `isFirebaseSyncConfigured()` is false in packaged apps even when sync works in dev.

Use the **same** Firebase **project** as mobile (`EXPO_PUBLIC_*` → `VITE_*` for the web client config). In **Project settings → Your apps**, register **two** Apple apps if you ship both: **`com.chinotto.mobile`** (Expo) and **`app.chinotto`** (desktop Tauri / Mac App Store). Native Sign in with Apple on Mac sends an ID token whose JWT **`aud`** is **`app.chinotto`**; Firebase rejects **`auth/invalid-credential`** (audience mismatch) until that bundle id exists in the project.

### QR bridge → mobile (always)

- **Header:** **Enable sync** opens `SyncModal` for every user (does not require `VITE_FIREBASE_*`).  
- **QR URL:** `https://getchinotto.app/sync` plus per-open **`?ds=<uuid-v4>`** for Firestore `sync_desktop_sessions` (contract: `chinotto-mobile/docs/sync/desktop-handoff-monetization-deeplinks.md`, `chinotto-mobile/docs/sync/sync.md` §3). **Copy App Store link** copies `CHINOTTO_MAC_APP_STORE_URL` (`src/lib/chinottoLinks.ts`) for install-only — no `ds`; after installing, scan QR again or use bypass on desktop.  
- **Constant:** `CHINOTTO_SYNC_MOBILE_UNIVERSAL_LINK` in `src/components/SyncModal.tsx` — change there if the host/path changes (desktop still appends `ds`).  
- **Clipboard:** App Store link only; sync handoff is QR or bypass (see modal copy).

### OAuth (this Mac, when Firebase is configured)

- **Sync modal:** QR + Firestore gate; **Continue with Apple** is enabled only after mobile confirms unlock (`sync_desktop_sessions` or user taps **Already finished on your iPhone?**). **Sync is on** requires `users/{uid}.chinottoSyncAccess.active === true` from mobile (same field the modal polls via `getDocFromServer`).  
- **Packaged desktop (GitHub / website DMG):** **`native_apple_sign_in`** (Tauri) + **`signInWithAppleCredential`**. Release builds use **`Chinotto.entitlements`** (includes **`com.apple.developer.applesignin`**) and embed **`Chinotto.developer-id.provisionprofile`** in the app bundle (`tauri.conf.json` → `bundle.macOS.files`) so Sign in with Apple works after notarization and the app still launches on **macOS 26+**. CI writes the profile from secret **`CHINOTTO_DEVELOPER_ID_PROVISIONING_PROFILE`** (base64 `.provisionprofile` for **`app.chinotto`**, Developer ID distribution). **`Chinotto.developer-id.entitlements`** (mic/audio only) remains for adhoc **`scripts/sign-macos.sh`**. **Local team-signed** testing: **`scripts/codesign-macos-dev.sh`**. **Mac App Store:** **`Chinotto.mas.entitlements`** via **`scripts/build-mas-testflight.sh`**.  
- **Dev (`npm run tauri dev`):** **`openUrl`** to **`http://localhost:5173/chinotto-oauth?…`** (Vite **`OAuthBridge`**), then a short-lived **`127.0.0.1`** listener in the app receives the credential via **`start_oauth_dev_bridge_listener`**. **Path:** `/chinotto-oauth` (path-based routing survives redirects better than query-only).  
- **Firebase → Authentication → Settings → Authorized domains:** include **`localhost`** and **`127.0.0.1`** for the **dev** browser + loopback bridge.  
- **`init.json`:** `https://{authDomain}/__/firebase/init.json` — **404** usually means wrong **`authDomain`** / project; it is not served from this repo’s Hosting root.

### Firebase Hosting (optional)

Deploy with **`npm run deploy:hosting`** when you want **`https://<projectId>.web.app/`** (Mac-app-only landing) or other static pages. Packaged **Continue with Apple** does not load **`/chinotto-oauth`** from Hosting. The React **`OAuthBridge`** route is for **dev (Vite)** and for opening that URL in a normal browser. **`src-tauri/capabilities/oauth-host.json`** remains for hosted / webview flows if you use them.

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
| **`auth/unauthorized-domain`** | Usually **dev**: OAuth ran on a host not listed under **Authorized domains** — add **`localhost`** / **`127.0.0.1`**. If you run Firebase inside **`tauri://`**, use the **Vite + localhost** dev flow instead. |
| **`auth/invalid-credential`** — audience **`app.chinotto`** | Firebase project is missing an **Apple** app registration with bundle id **`app.chinotto`** (see **§ Configuration**). Add it in Console, wait a minute, retry. |
| **“Could not start sign-in”** on packaged Mac | Release DMG must ship **`Chinotto.entitlements`** + **`embedded.provisionprofile`** (see **§ OAuth**). Missing entitlement/profile breaks **`native_apple_sign_in`**. Console: `[Chinotto sync oauth] native_apple_sign_in failed`. |
| **“Could not start this step”** / **Touch ID** then failure on packaged Mac | Entitlements / signing / provisioning for native SIWA, or Firebase **`app.chinotto`** registration — compare **`Chinotto.mas.entitlements`** and the **`auth/invalid-credential`** row above. |
| **App won’t open** — **RBSRequestErrorDomain** / **Launchd job spawn failed** (**163**) | **`com.apple.developer.applesignin`** without a matching **`embedded.provisionprofile`**. Ensure CI secret **`CHINOTTO_DEVELOPER_ID_PROVISIONING_PROFILE`** is set and the profile matches **`app.chinotto`**. |
| Blank OAuth | `VITE_FIREBASE_APP_ID`, `authDomain`. |
| **`tombstone snapshot error` / `tombstone getDocs failed`** | Missing Firestore **composite index** (link in error). |
| **`tombstone apply failed`** | IPC: use **`entryIds`** at top level — see **§ Desktop IPC**. |
| **`database is locked`** on tombstone flush | **Mobile** — see **§ Mobile reference**. |
| **`permission-denied`** on `sync_desktop_sessions` or `users/{uid}` (desktop console: `[chinotto sync] … gate` / `user sync access`) | **Firestore rules** in the Firebase project do not match the wire contract. Publish the **Security Rules** block from `chinotto-mobile/docs/sync/sync.md` (public read on `sync_desktop_sessions`; authenticated owner read/write on `users/{userId}` and `entries`). |

---

## Limits & explicit non-goals

| Limit | Detail |
|-------|--------|
| Backfill cap | ~**20k** newest actives by `createdAt`; extend pagination if needed. |
| Tombstone window | **1000** newest tombstones by `deletedAt`. |
| Edit sync | Desktop **pushes** `text` + `updatedAt` after local save; mobile **apply** path is separate; ingest insert-only on desktop. |
| Read cost | Backfill + forced tombstone reads per sign-in / snapshot; tradeoff for correctness and WKWebView reliability. |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-30 | **Desktop:** If the Firebase user / `users/{uid}` cloud path is invalid (e.g. account removed on mobile), ingest and profile listeners stop, tombstone outbox is cleared, and the client signs out of Firebase for local-only use without tight error retries. |
| 2026-04-26 | **Desktop OAuth:** Packaged **Continue with Apple** uses **native** Sign in with Apple (`native_apple_sign_in`) + Firebase; register **`app.chinotto`** in Firebase alongside **`com.chinotto.mobile`**. **Dev** still uses Vite **`/chinotto-oauth`** + **`127.0.0.1`** bridge. |
| 2026-04-13 | **Desktop:** After `update_entry` (detail debounce, unmount flush, stream late edit): `getEntry` → Firestore merge with `updatedAt: serverTimestamp()`; `generate_embedding` refresh. **Rust:** Firestore ingest `INSERT` includes `updated_at`. **Wire:** optional `updatedAt` on entry docs for mobile ordering. |
| 2026-04-02 | **Docs:** Canonical **Enable sync / unlock** flow — `chinotto-mobile/docs/sync/cross-device-sync-unlock-flow.md` (desktop `SyncModal` states, `ds` gate, `chinottoSyncAccess`). |
| 2026-03-29 | **Docs:** Merged `sync-deletion-v2.md`, `sync-v2-as-built.md`, `sync-mobile-parity-and-followups.md`, and `firestore-sync.md` into this file. Release QA lives only in `sync-release-checklist.md`. |

*(Add a row when sync behavior or contract alignment changes materially.)*
