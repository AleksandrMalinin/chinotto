# Firestore pull sync (desktop)

Normative product and data contract: **`chinotto-mobile/docs/SYNC.md`**. Desktop implements **v1 ingest only**: Sign in with Apple (Firebase Auth), subscribe to `users/{uid}/entries`, merge into local SQLite by `id` (`INSERT OR IGNORE`).

## Configuration

Set Vite env vars (same Firebase Web app as mobile; mobile uses `EXPO_PUBLIC_*`):

| Variable | Notes |
|----------|--------|
| `VITE_FIREBASE_API_KEY` | Required for sync UI + listener |
| `VITE_FIREBASE_PROJECT_ID` | Required |
| `VITE_FIREBASE_AUTH_DOMAIN` | Optional; defaults to `{projectId}.firebaseapp.com` if unset |
| `VITE_FIREBASE_APP_ID` | Recommended |
| `VITE_FIREBASE_STORAGE_BUCKET` | Optional |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Optional |

Copy from the mobile `.env.example` and rename the prefix to `VITE_`.

## Behavior

- **Header → Sync:** when env is set, **Sync** opens a short modal; **Continue with Apple** opens a **small secondary window** (release) or the **default browser** (dev) for Firebase + Apple. The main window receives tokens via a Tauri event. The modal stays calmer than a long Settings section; sign-in still completes outside the main window.

### Development (`tauri dev`, `import.meta.env.DEV`)

Firebase’s redirect + iframe completion often **fails inside Tauri’s auxiliary WKWebView**. In dev, **Continue with Apple** opens your **default browser** at the same Vite URL (`/chinotto-oauth?…`). **Safari blocks sign-in popups unless you tap a button on that page**; the bridge page asks for a tap before calling Firebase so the Apple window can open. Sign-in runs in Safari/Chrome; the app listens on **`127.0.0.1`** for a one-shot POST and forwards the credential to the main window. Leave **`npm run dev`** running, complete Apple in the browser, then close the tab when you see “Signed in”. The bridge `port` / `secret` are stored in **sessionStorage** because Firebase’s return URL usually **drops** those query params. Add **`localhost`** and **`127.0.0.1`** under Firebase Authentication → **Authorized domains** if either is missing.

## Firebase Hosting (required for web redirect)

The Firebase JS SDK sends the browser to **`https://{authDomain}/__/auth/handler`**. That page loads **`https://{authDomain}/__/firebase/init.json`**. If you see **404 on `init.json`** in the OAuth window’s Web Inspector, **Firebase Hosting has never been deployed** (or not for this project). Without it, redirect sign-in fails (often followed by **400** on `identitytoolkit` `createAuthUri`).

**Fix (one-time per Firebase project):** install [Firebase CLI](https://firebase.google.com/docs/cli), run `firebase login`, `firebase init hosting` (link the same project as mobile), then `firebase deploy --only hosting`. You can use a minimal `public/index.html`; Firebase serves the reserved `__/firebase/*` paths after the first hosting deploy.

## Troubleshooting

| Symptom | Likely cause |
|--------|----------------|
| Console: **404** `__/firebase/init.json` on `{project}.firebaseapp.com` | Deploy Firebase Hosting (see above). |
| Console: **400** `createAuthUri` (Identity Toolkit) | Browser API key restrictions in Google Cloud (allow **Identity Toolkit API** for this key, or use a **Web**-appropriate key from Firebase Console → Project settings → Your apps). Also confirm **Authentication → Sign-in method → Apple** is configured and **Authorized domains** include `localhost` (dev) and any production host. |
| Blank OAuth window, repeated errors | Ensure `VITE_FIREBASE_APP_ID` matches the **Web** app in Firebase (same object as mobile’s web config). `VITE_FIREBASE_AUTH_DOMAIN` can be omitted only if the default `{projectId}.firebaseapp.com` is correct (custom auth domains must be set explicitly). |
- **Listener:** After a **non-anonymous** user signs in, `onSnapshot` on `users/{uid}/entries` with `orderBy('createdAt','desc')` and `limit(500)`.
- **SQLite:** `ingest_firestore_entries` Tauri command; skips existing ids and ids **deleted on this desktop** (`firestore_ingest_suppressed_ids`) so a doc that still exists in Firestore is not pulled back after a local delete; creating an entry again (including restore with the same id) clears that suppression for the id. `delete_all_entries` clears suppressions so a full local wipe can repopulate from Firestore. Invalid/empty rows are skipped.
- **Stream order:** `list_entries` uses `ORDER BY created_at DESC, id ASC` (tie-break per SYNC.md).

## Firebase Console

Enable **Apple** under Authentication; authorize OAuth domains used by the desktop app (e.g. localhost for dev, production host if any).

## Implementation files

- `src/lib/firebaseConfig.ts` — env gate + web `FirebaseOptions`
- `src/lib/desktopFirestoreSync.ts` — Auth + Firestore listener
- `src/components/SyncModal.tsx` — header “Sync” entry; Apple sign-in and status
- `src/lib/useAppleSyncOAuth.ts` — OAuth webview / dev browser + Tauri event listeners
- `src/components/OAuthBridge.tsx` — redirect flow in the secondary window or browser tab only
- `src/main.tsx` — renders `OAuthBridge` when `?chinotto_oauth=1` (not under React `StrictMode` in dev)
- `src-tauri`: `ingest_firestore_entries`, `Db::ingest_firestore_entries`
