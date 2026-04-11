import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  linkWithCredential,
  onAuthStateChanged,
  OAuthProvider,
  signInWithCredential,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  deleteField,
  doc,
  enableNetwork,
  getDocFromServer,
  getDocs,
  initializeFirestore,
  limit,
  memoryLocalCache,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  where,
  type CollectionReference,
  type DocumentData,
  type DocumentSnapshot,
  type Firestore,
  type Query,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  clearFirestoreIngestSuppression,
  deleteLocalEntriesForSync,
  enqueueSyncTombstone,
  ingestFirestoreEntries,
  listSyncTombstoneOutbox,
  removeSyncTombstoneOutbox,
} from "@/features/entries/entryApi";
import { getFirebaseWebOptions, isFirebaseSyncConfigured } from "./firebaseConfig";
import { isFirestoreDocumentTombstoned } from "./firestoreTombstone";

/** Shape of `OAuthCredential.toJSON()` from the OAuth bridge webview (Apple redirect). */
export type BridgedOAuthCredentialJson = {
  providerId: string;
  signInMethod: string;
  idToken?: string;
  accessToken?: string;
  secret?: string;
  nonce?: string;
  pendingToken?: string | null;
};

const INGEST_PAGE_SIZE = 500;
/** Matches mobile backfill cap (~20k docs). */
const INGEST_BACKFILL_MAX_PAGES = 40;
/** Tombstones are queried separately so deletes on older entries (outside the recent ingest window) still apply locally. */
const TOMBSTONE_QUERY_LIMIT = 1000;
/**
 * Desktop sync modal **gate** (`sync_desktop_sessions/{ds}`) only: poll interval.
 * Fewer watch streams on that path mitigates Firestore INTERNAL ASSERTION b815/ca9 in embedded WebKit.
 */
const SYNC_MODAL_GATE_POLL_MS = 2500;
/** Re-read `users/{uid}` while waiting for mobile to set `active: true` (stuck snapshot workaround). */
const SYNC_ACCESS_WAITING_POLL_MS = 800;
/** Extra server reads after subscribe (ms) — mobile may write `active` right after the first read. */
const SYNC_ACCESS_WAITING_STAGGER_MS = [250, 550, 1100] as const;
/** After `active` is true, still re-read occasionally so **turning sync off on mobile** reaches desktop if `onSnapshot` stalls. */
const SYNC_ACCESS_WHILE_ACTIVE_POLL_MS = 30000;
/** After focus/visibility: short burst of server reads while still waiting for `active: true` (timers are throttled in background WebViews). */
const SYNC_ACCESS_FOCUS_BURST_MS = 1000;
const SYNC_ACCESS_FOCUS_BURST_MAX = 15;
/** After we have shown sync active, delay reporting inactive so focus/reattach glitches do not flip the header or modal. */
const SYNC_ACCESS_EMIT_FALSE_DEBOUNCE_MS = 450;

const FIRESTORE_RULES_SYNC_MODAL_HINT =
  "Firestore Security Rules must allow: (1) anyone may read sync_desktop_sessions/{sessionId}; " +
  "(2) signed-in users may read/write users/{userId} when request.auth.uid == userId. " +
  "Paste rules from chinotto-mobile docs/sync/sync.md (Security Rules) and Publish in Firebase Console.";

function isFirestorePermissionDenied(e: unknown): boolean {
  if (e && typeof e === "object" && "code" in e) {
    const c = String((e as { code: string }).code);
    return c === "permission-denied";
  }
  return false;
}

/** Mobile-written field on `users/{uid}`; keep in sync with chinotto-mobile `firestoreSyncAccessMirror`. */
export function isChinottoSyncAccessActiveInUserDoc(data: DocumentData | undefined): boolean {
  return data?.chinottoSyncAccess?.active === true;
}

/**
 * Enable sync modal / header: **only** `users/{uid}.chinottoSyncAccess.active === true` (mobile mirror).
 */

/**
 * Doc ids from the latest tombstone-query snapshot. Firestore already filtered `deletedAt != null`;
 * we trust the query result even when `instanceof Timestamp` / tombstone heuristics fail (duplicate SDK
 * bundles, plain `{ seconds }` shapes). Also used to block ingest from re-adding rows on stale cache.
 */
let lastTombstoneQueryDocIds: ReadonlySet<string> = new Set();

/** Throttle for getDocs tombstone reconcile (onSnapshot can be unreliable in some webviews). */
let lastTombstoneGetDocsAt = 0;

let appSingleton: FirebaseApp | null = null;
let dbSingleton: Firestore | null = null;

function getOrInitApp(): FirebaseApp {
  if (appSingleton) {
    return appSingleton;
  }
  if (getApps().length > 0) {
    appSingleton = getApp();
    return appSingleton;
  }
  appSingleton = initializeApp(getFirebaseWebOptions());
  return appSingleton;
}

function getOrInitFirestore(): Firestore {
  if (dbSingleton) {
    return dbSingleton;
  }
  dbSingleton = initializeFirestore(getOrInitApp(), {
    localCache: memoryLocalCache(),
  });
  return dbSingleton;
}

export type SyncIngestRow = { id: string; text: string; createdAt: string };

/** Exported for tests. Converts Firestore `createdAt` wire shapes to RFC3339 for Rust `ingest_firestore_entries`. */
export function normalizeFirestoreCreatedAtForIngest(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "object" && value !== null) {
    const o = value as Record<string, unknown>;
    if (typeof o.toDate === "function") {
      const d = (o as { toDate: () => Date }).toDate();
      if (d instanceof Date && !Number.isNaN(d.getTime())) {
        return d.toISOString();
      }
      return null;
    }
    if (typeof o.seconds === "number" && Number.isFinite(o.seconds)) {
      const nano =
        typeof o.nanoseconds === "number" && Number.isFinite(o.nanoseconds)
          ? o.nanoseconds
          : 0;
      return new Date(o.seconds * 1000 + nano / 1e6).toISOString();
    }
  }
  return null;
}

function partitionFirestoreSnapshotDocs(
  docs: QueryDocumentSnapshot<DocumentData>[]
): { tombstonedIds: string[]; activeRows: SyncIngestRow[] } {
  const tombstonedIds: string[] = [];
  const activeRows: SyncIngestRow[] = [];
  for (const d of docs) {
    const data = d.data();
    if (isFirestoreDocumentTombstoned(data)) {
      tombstonedIds.push(d.id);
      continue;
    }
    const text = typeof data.text === "string" ? data.text.trim() : "";
    if (!text) {
      continue;
    }
    const createdAt = normalizeFirestoreCreatedAtForIngest(data.createdAt);
    if (!createdAt) {
      continue;
    }
    activeRows.push({ id: d.id, text, createdAt });
  }
  return { tombstonedIds, activeRows };
}

async function applyRemoteTombstonesById(ids: string[]): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }
  try {
    return await deleteLocalEntriesForSync(ids);
  } catch (e) {
    console.error("[chinotto sync] tombstone apply failed", e);
    return 0;
  }
}

function tombstoneQuery(coll: CollectionReference<DocumentData>) {
  return query(
    coll,
    where("deletedAt", "!=", null),
    orderBy("deletedAt", "desc"),
    limit(TOMBSTONE_QUERY_LIMIT)
  );
}

/**
 * One-shot server read of tombstoned doc ids (same query as the tombstone listener).
 * Backs up onSnapshot when the listener errors, never attaches, or misses updates in Tauri.
 */
/**
 * Paginated `getDocs` for active-shaped docs outside the live `limit(500)` window (mobile parity).
 * Idempotent with `INSERT OR IGNORE`; respects tombstone query ids and per-doc tombstone field.
 */
async function runFirestoreIngestBackfill(
  coll: CollectionReference<DocumentData>,
  onIngested: () => void,
  shouldAbort: () => boolean
): Promise<void> {
  let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
  let insertedTotal = 0;

  for (let page = 0; page < INGEST_BACKFILL_MAX_PAGES; page++) {
    if (shouldAbort()) {
      return;
    }
    const q: Query<DocumentData> = lastDoc
      ? query(
          coll,
          orderBy("createdAt", "desc"),
          startAfter(lastDoc),
          limit(INGEST_PAGE_SIZE)
        )
      : query(coll, orderBy("createdAt", "desc"), limit(INGEST_PAGE_SIZE));

    let snap;
    try {
      snap = await getDocs(q);
    } catch (e) {
      console.error("[chinotto sync] ingest backfill getDocs failed", e);
      return;
    }
    if (shouldAbort()) {
      return;
    }
    if (snap.empty) {
      break;
    }

    const docs = snap.docs as QueryDocumentSnapshot<DocumentData>[];
    lastDoc = docs[docs.length - 1]!;
    const { tombstonedIds, activeRows } = partitionFirestoreSnapshotDocs(docs);
    await applyRemoteTombstonesById(tombstonedIds);
    if (shouldAbort()) {
      return;
    }
    const activeRowsSafe = activeRows.filter((r) => !lastTombstoneQueryDocIds.has(r.id));
    if (activeRowsSafe.length > 0) {
      try {
        const inserted = await ingestFirestoreEntries(activeRowsSafe);
        insertedTotal += inserted;
      } catch (e) {
        if (import.meta.env.DEV) {
          console.error("[chinotto sync] ingest backfill batch failed", e);
        }
        return;
      }
    }

    if (snap.docs.length < INGEST_PAGE_SIZE) {
      break;
    }
  }

  if (insertedTotal > 0) {
    onIngested();
  }
}

async function pullTombstonesFromServer(
  coll: CollectionReference<DocumentData>,
  onIngested: () => void,
  options: { force?: boolean; minIntervalMs?: number } = {}
): Promise<void> {
  const force = options.force ?? false;
  const minMs = options.minIntervalMs ?? 2000;
  const now = Date.now();
  if (!force && now - lastTombstoneGetDocsAt < minMs) {
    return;
  }
  lastTombstoneGetDocsAt = now;
  try {
    const snap = await getDocs(tombstoneQuery(coll));
    const ids = snap.docs.map((d) => d.id);
    lastTombstoneQueryDocIds = new Set(ids);
    const removed = await applyRemoteTombstonesById(ids);
    if (removed > 0) {
      onIngested();
    }
  } catch (e) {
    console.error("[chinotto sync] tombstone getDocs failed", e);
  }
}

export type FirestoreEntryPush = {
  id: string;
  text: string;
  created_at: string;
};

/**
 * Upsert `users/{uid}/entries/{id}` so mobile (and other clients) receive new or restored thoughts.
 * Uses merge; `deletedAt` is cleared so Cmd+Z after a synced delete can revive the doc remotely.
 */
export async function pushEntryUpsertToFirestore(entry: FirestoreEntryPush): Promise<void> {
  if (!isFirebaseSyncConfigured()) {
    return;
  }
  const auth = getAuth(getOrInitApp());
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    return;
  }
  const trimmed = entry.text.trim();
  if (!trimmed) {
    return;
  }
  const ms = Date.parse(entry.created_at);
  if (Number.isNaN(ms)) {
    return;
  }
  const db = getOrInitFirestore();
  const ref = doc(db, "users", user.uid, "entries", entry.id);
  try {
    await setDoc(
      ref,
      {
        text: trimmed,
        createdAt: Timestamp.fromMillis(ms),
        deletedAt: deleteField(),
      },
      { merge: true }
    );
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn("[chinotto sync] push entry failed", entry.id, e);
    }
  }
}

/**
 * Flush pending `{ op: "tombstone", entryId }` rows to Firestore with `deletedAt: serverTimestamp()`.
 * Idempotent: `setDoc` + merge on an already-tombstoned doc is allowed.
 */
export async function flushSyncTombstoneOutbox(): Promise<void> {
  if (!isFirebaseSyncConfigured()) {
    return;
  }
  const auth = getAuth(getOrInitApp());
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    return;
  }
  const db = getOrInitFirestore();
  const ids = await listSyncTombstoneOutbox();
  for (const entryId of ids) {
    const ref = doc(db, "users", user.uid, "entries", entryId);
    try {
      await setDoc(ref, { deletedAt: serverTimestamp() }, { merge: true });
      await removeSyncTombstoneOutbox(entryId);
      await clearFirestoreIngestSuppression(entryId);
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn("[chinotto sync] tombstone flush failed, will retry", entryId, e);
      }
    }
  }
}

/**
 * After local SQLite delete (user action): enqueue tombstone and try immediate Firestore flush.
 */
export async function notifyEntryDeletedForSync(entryId: string): Promise<void> {
  if (!isFirebaseSyncConfigured()) {
    return;
  }
  await enqueueSyncTombstone(entryId);
  await flushSyncTombstoneOutbox();
}

/**
 * Subscribe to auth + Firestore `users/{uid}/entries` (see `docs/sync.md`; wire contract: mobile `docs/sync.md`).
 * Applies remote tombstones (physical local delete) and ingests active docs.
 */
export function startDesktopFirestoreIngest(onIngested: () => void): () => void {
  if (!isFirebaseSyncConfigured()) {
    return () => {};
  }

  let auth: ReturnType<typeof getAuth>;
  try {
    auth = getAuth(getOrInitApp());
  } catch (e) {
    console.error("[chinotto sync] Firebase init failed; sync disabled for this session.", e);
    return () => {};
  }

  let unsubIngest: (() => void) | undefined;
  let unsubTombstones: (() => void) | undefined;
  let tombstonePollTimer: ReturnType<typeof setInterval> | undefined;
  let ingestBackfillAbort = false;

  const detachFirestoreListeners = () => {
    ingestBackfillAbort = true;
    if (tombstonePollTimer != null) {
      clearInterval(tombstonePollTimer);
      tombstonePollTimer = undefined;
    }
    lastTombstoneQueryDocIds = new Set();
    lastTombstoneGetDocsAt = 0;
    unsubIngest?.();
    unsubIngest = undefined;
    unsubTombstones?.();
    unsubTombstones = undefined;
  };

  const unsubAuth = onAuthStateChanged(auth, (user) => {
    detachFirestoreListeners();
    if (!user || user.isAnonymous) {
      return;
    }
    ingestBackfillAbort = false;
    const uidAtStart = user.uid;
    let coll: ReturnType<typeof collection>;
    try {
      const db = getOrInitFirestore();
      coll = collection(db, "users", user.uid, "entries");
    } catch (e) {
      console.error("[chinotto sync] Firestore init failed after sign-in; ingest skipped.", e);
      return;
    }

    void (async () => {
      await flushSyncTombstoneOutbox();
      const stillSignedIn = () =>
        !ingestBackfillAbort &&
        auth.currentUser != null &&
        auth.currentUser.uid === uidAtStart &&
        !auth.currentUser.isAnonymous;
      if (!stillSignedIn()) {
        return;
      }
      await pullTombstonesFromServer(coll, onIngested, { force: true });
      if (!stillSignedIn()) {
        return;
      }
      await runFirestoreIngestBackfill(coll, onIngested, () => !stillSignedIn());
      if (!stillSignedIn()) {
        return;
      }

      tombstonePollTimer = setInterval(() => {
        void pullTombstonesFromServer(coll, onIngested, { force: true });
      }, 12_000);
      const qIngest = query(coll, orderBy("createdAt", "desc"), limit(INGEST_PAGE_SIZE));
      unsubIngest = onSnapshot(
        qIngest,
        async (snap) => {
          // Always reconcile tombstones from the server before ingesting "active" rows from this
          // snapshot. Otherwise `pullTombstonesFromServer` can no-op (2s throttle) while `snap` is
          // still stale → we skip `lastTombstoneQueryDocIds` and re-insert a row Firestore already
          // tombstoned (mobile wrote `deletedAt`).
          await pullTombstonesFromServer(coll, onIngested, { force: true });
          const { tombstonedIds, activeRows } = partitionFirestoreSnapshotDocs(
            snap.docs as QueryDocumentSnapshot<DocumentData>[]
          );
          let changed = false;
          const removedMain = await applyRemoteTombstonesById(tombstonedIds);
          if (removedMain > 0) {
            changed = true;
          }
          const activeRowsSafe = activeRows.filter((r) => !lastTombstoneQueryDocIds.has(r.id));
          if (activeRowsSafe.length > 0) {
            try {
              const inserted = await ingestFirestoreEntries(activeRowsSafe);
              if (inserted > 0) {
                changed = true;
              }
            } catch (e) {
              if (import.meta.env.DEV) {
                console.error("[chinotto sync] ingest failed", e);
              }
            }
          }
          if (changed) {
            onIngested();
          }
          await flushSyncTombstoneOutbox();
        },
        (err) => {
          console.error("[chinotto sync] ingest snapshot error", err);
        }
      );

      const qTombstones = tombstoneQuery(coll);
      unsubTombstones = onSnapshot(
        qTombstones,
        async (snap) => {
          // Query already enforces `deletedAt != null`; do not rely on JS tombstone heuristics here.
          const ids = snap.docs.map((d) => d.id);
          lastTombstoneQueryDocIds = new Set(ids);
          const removed = await applyRemoteTombstonesById(ids);
          if (removed > 0) {
            onIngested();
          }
          await flushSyncTombstoneOutbox();
        },
        (err) => {
          console.error("[chinotto sync] tombstone snapshot error", err);
        }
      );
    })();
  });

  return () => {
    detachFirestoreListeners();
    unsubAuth();
  };
}

function authErrorCode(e: unknown): string {
  if (e && typeof e === "object" && "code" in e && typeof (e as { code: unknown }).code === "string") {
    const c = (e as { code: string }).code;
    /** Some SDKs / wrappers emit `failed-precondition` without the `auth/` prefix. */
    return c === "failed-precondition" ? "auth/failed-precondition" : c;
  }
  return "";
}

function isAuthFailedPrecondition(e: unknown): boolean {
  return authErrorCode(e) === "auth/failed-precondition";
}

/**
 * Applies the Apple OAuth credential from the bridge webview in the **main** window.
 *
 * `signInWithCredential` can throw `auth/failed-precondition` if a non-anonymous user is already
 * signed in (Firebase expects sign-out or `linkWithCredential` for anonymous). We sign out first
 * when replacing an existing session so “Continue with Apple” always applies the fresh credential.
 */
export async function signInWithAppleCredential(credentialJson: BridgedOAuthCredentialJson): Promise<void> {
  if (!isFirebaseSyncConfigured()) {
    throw new Error("Sync is not configured");
  }
  const idToken = credentialJson.idToken?.trim();
  if (!idToken) {
    throw new Error("Apple sign-in did not provide an ID token");
  }
  const auth = getAuth(getOrInitApp());
  await auth.authStateReady();
  const credential = OAuthProvider.credentialFromJSON({
    ...credentialJson,
    idToken,
    accessToken: credentialJson.accessToken?.trim() ? credentialJson.accessToken : undefined,
  });
  if (!credential) {
    throw new Error("Apple sign-in credential could not be built");
  }

  const signInAfterClearingSession = async () => {
    try {
      await signInWithCredential(auth, credential);
    } catch (e) {
      if (!isAuthFailedPrecondition(e)) {
        throw e;
      }
      await signOut(auth);
      await auth.authStateReady();
      await signInWithCredential(auth, credential);
    }
  };

  const cur = auth.currentUser;
  if (cur?.isAnonymous) {
    try {
      await linkWithCredential(cur, credential);
    } catch (e) {
      if (isAuthFailedPrecondition(e)) {
        await signOut(auth);
        await auth.authStateReady();
        await signInAfterClearingSession();
      } else {
        throw e;
      }
    }
  } else if (cur) {
    await signOut(auth);
    await auth.authStateReady();
    await signInAfterClearingSession();
  } else {
    await signInAfterClearingSession();
  }

  await flushSyncTombstoneOutbox();
}

export async function signOutFirebaseSync(): Promise<void> {
  if (!isFirebaseSyncConfigured()) {
    return;
  }
  const auth = getAuth(getOrInitApp());
  await signOut(auth);
}

export function subscribeSyncAuth(onChange: (user: User | null) => void): () => void {
  if (!isFirebaseSyncConfigured()) {
    onChange(null);
    return () => {};
  }
  try {
    const auth = getAuth(getOrInitApp());
    return onAuthStateChanged(auth, onChange);
  } catch (e) {
    console.error("[chinotto sync] subscribeSyncAuth: Firebase init failed.", e);
    onChange(null);
    return () => {};
  }
}

/**
 * Desktop sync modal: poll for mobile unlock on this session (`?ds=` on the QR URL).
 * Uses **getDocFromServer** polling (not cache) instead of onSnapshot to avoid extra watch streams
 * (see SYNC_MODAL_GATE_POLL_MS) and stale `chinottoSyncAccess` after mobile writes.
 * Rules must allow unauthenticated **read** on `sync_desktop_sessions/{sessionId}`.
 */
export function subscribeDesktopSyncGateSession(
  sessionId: string,
  onUnlocked: (unlocked: boolean) => void,
  options?: { onPermissionDenied?: () => void; onReadSucceeded?: () => void }
): () => void {
  if (!isFirebaseSyncConfigured()) {
    onUnlocked(false);
    return () => {};
  }
  if (!sessionId?.trim()) {
    onUnlocked(false);
    return () => {};
  }
  try {
    const db = getOrInitFirestore();
    const ref = doc(db, "sync_desktop_sessions", sessionId);
    let stopped = false;
    let loggedPermissionDenied = false;
    const poll = async () => {
      if (stopped) {
        return;
      }
      try {
        const snap = await getDocFromServer(ref);
        if (stopped) {
          return;
        }
        options?.onReadSucceeded?.();
        onUnlocked(snap.data()?.unlocked === true);
      } catch (e) {
        if (isFirestorePermissionDenied(e)) {
          if (!loggedPermissionDenied) {
            loggedPermissionDenied = true;
            console.warn(
              `[chinotto sync] desktop gate: permission denied — ${FIRESTORE_RULES_SYNC_MODAL_HINT}`,
              e
            );
            options?.onPermissionDenied?.();
          }
        } else {
          console.error("[chinotto sync] desktop gate poll error", e);
        }
        if (!stopped) {
          onUnlocked(false);
        }
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), SYNC_MODAL_GATE_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  } catch (e) {
    console.error("[chinotto sync] desktop gate listener setup failed", e);
    onUnlocked(false);
    return () => {};
  }
}

/**
 * After Sign in with Apple: mobile mirrors paid sync access on `users/{uid}`.
 * Uses **`onSnapshot`** for push updates, plus **`getDocFromServer`** on focus/visibility and on a
 * timer (fast while waiting for access, slower while `active` so **revokes** from mobile still land
 * if the listener stalls) — embedded WebKit can stop delivering snapshot updates until restart.
 * On **focus / visibility**, nudges the client with `enableNetwork`, **re-attaches** the snapshot
 * listener, and (while still waiting for `active`) runs a short **burst** of server reads — background
 * tabs throttle `setInterval`, so polling alone may not run until the app is restarted.
 * Transitions to **inactive** are debounced briefly once the UI has shown active, so reattach/network
 * hiccups after restore from tray do not flash “sync off”.
 */
export function subscribeChinottoUserSyncAccess(
  uid: string,
  onActive: (active: boolean) => void,
  options?: { onPermissionDenied?: () => void; onReadSucceeded?: () => void }
): () => void {
  if (!isFirebaseSyncConfigured()) {
    onActive(false);
    return () => {};
  }
  if (!uid?.trim()) {
    onActive(false);
    return () => {};
  }
  try {
    const db = getOrInitFirestore();
    const ref = doc(db, "users", uid);
    let stopped = false;
    let loggedPermissionDenied = false;
    let lastActive = false;
    let lastEmittedToUi: boolean | null = null;
    let emitFalsePending: ReturnType<typeof setTimeout> | null = null;

    const clearEmitFalsePending = () => {
      if (emitFalsePending != null) {
        clearTimeout(emitFalsePending);
        emitFalsePending = null;
      }
    };

    const emitActiveToUi = (active: boolean) => {
      if (stopped) {
        return;
      }
      if (active) {
        clearEmitFalsePending();
        if (lastEmittedToUi !== true) {
          lastEmittedToUi = true;
          onActive(true);
        }
        return;
      }
      if (lastEmittedToUi !== true) {
        if (lastEmittedToUi !== false) {
          lastEmittedToUi = false;
          onActive(false);
        }
        return;
      }
      clearEmitFalsePending();
      emitFalsePending = setTimeout(() => {
        emitFalsePending = null;
        if (stopped) {
          return;
        }
        lastEmittedToUi = false;
        onActive(false);
      }, SYNC_ACCESS_EMIT_FALSE_DEBOUNCE_MS);
    };

    let serverPoll: ReturnType<typeof setInterval> | null = null;
    const clearServerPoll = () => {
      if (serverPoll != null) {
        clearInterval(serverPoll);
        serverPoll = null;
      }
    };

    const scheduleServerPoll = () => {
      clearServerPoll();
      if (stopped) {
        return;
      }
      const ms = lastActive ? SYNC_ACCESS_WHILE_ACTIVE_POLL_MS : SYNC_ACCESS_WAITING_POLL_MS;
      serverPoll = setInterval(() => {
        void refetchFromServer();
      }, ms);
    };

    const applySnap = (snap: DocumentSnapshot) => {
      if (stopped) {
        return;
      }
      const prev = lastActive;
      lastActive = isChinottoSyncAccessActiveInUserDoc(snap.data());
      options?.onReadSucceeded?.();
      emitActiveToUi(lastActive);
      if (prev !== lastActive) {
        scheduleServerPoll();
      }
    };

    const applyError = (e: unknown) => {
      if (isFirestorePermissionDenied(e)) {
        if (!loggedPermissionDenied) {
          loggedPermissionDenied = true;
          console.warn(
            `[chinotto sync] user sync access: permission denied — ${FIRESTORE_RULES_SYNC_MODAL_HINT}`,
            e
          );
          options?.onPermissionDenied?.();
        }
      } else {
        console.error("[chinotto sync] user sync access listener error", e);
      }
      if (!stopped) {
        const prev = lastActive;
        lastActive = false;
        emitActiveToUi(false);
        if (prev !== lastActive) {
          scheduleServerPoll();
        }
      }
    };

    const refetchFromServer = async () => {
      if (stopped) {
        return;
      }
      try {
        const snap = await getDocFromServer(ref);
        if (stopped) {
          return;
        }
        applySnap(snap);
      } catch (e) {
        if (isFirestorePermissionDenied(e)) {
          applyError(e);
        } else {
          console.warn("[chinotto sync] user sync access: getDocFromServer refetch failed", e);
        }
      }
    };

    let snapshotUnsub: (() => void) | null = null;

    const attachSnapshotListener = () => {
      if (snapshotUnsub != null) {
        snapshotUnsub();
        snapshotUnsub = null;
      }
      if (stopped) {
        return;
      }
      snapshotUnsub = onSnapshot(ref, applySnap, applyError);
    };

    attachSnapshotListener();

    scheduleServerPoll();
    void refetchFromServer();

    const staggerIds: number[] = [];
    for (const ms of SYNC_ACCESS_WAITING_STAGGER_MS) {
      staggerIds.push(
        window.setTimeout(() => {
          if (stopped || lastActive) {
            return;
          }
          void refetchFromServer();
        }, ms)
      );
    }

    let focusDebounce: ReturnType<typeof setTimeout> | null = null;
    let focusBurst: ReturnType<typeof setInterval> | null = null;
    const clearFocusBurst = () => {
      if (focusBurst != null) {
        clearInterval(focusBurst);
        focusBurst = null;
      }
    };

    const scheduleFocusRecover = () => {
      if (typeof window === "undefined") {
        return;
      }
      if (focusDebounce != null) {
        clearTimeout(focusDebounce);
      }
      focusDebounce = setTimeout(() => {
        focusDebounce = null;
        void (async () => {
          try {
            await enableNetwork(db);
          } catch {
            /* ignore — best-effort reconnect */
          }
          attachSnapshotListener();
          await refetchFromServer();
          clearFocusBurst();
          let burstCount = 0;
          focusBurst = setInterval(() => {
            if (stopped || lastActive) {
              clearFocusBurst();
              return;
            }
            burstCount += 1;
            if (burstCount > SYNC_ACCESS_FOCUS_BURST_MAX) {
              clearFocusBurst();
              return;
            }
            void refetchFromServer();
          }, SYNC_ACCESS_FOCUS_BURST_MS);
        })();
      }, 250);
    };

    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        scheduleFocusRecover();
      }
    };

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        scheduleFocusRecover();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("focus", scheduleFocusRecover);
      window.addEventListener("online", scheduleFocusRecover);
      window.addEventListener("pageshow", onPageShow);
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    let tauriFocusUnlisten: (() => void) | null = null;
    void (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const unlisten = await getCurrentWindow().onFocusChanged(({ payload: focused }) => {
          if (stopped) {
            return;
          }
          if (focused) {
            scheduleFocusRecover();
          }
        });
        if (stopped) {
          unlisten();
          return;
        }
        tauriFocusUnlisten = unlisten;
      } catch {
        /* Web build, tests, or non-Tauri — DOM focus/visibility only */
      }
    })();

    return () => {
      stopped = true;
      clearEmitFalsePending();
      for (const id of staggerIds) {
        clearTimeout(id);
      }
      clearServerPoll();
      clearFocusBurst();
      if (focusDebounce != null) {
        clearTimeout(focusDebounce);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", scheduleFocusRecover);
        window.removeEventListener("online", scheduleFocusRecover);
        window.removeEventListener("pageshow", onPageShow);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
      if (tauriFocusUnlisten != null) {
        tauriFocusUnlisten();
        tauriFocusUnlisten = null;
      }
      if (snapshotUnsub != null) {
        snapshotUnsub();
        snapshotUnsub = null;
      }
    };
  } catch (e) {
    console.error("[chinotto sync] user sync access listener setup failed", e);
    onActive(false);
    return () => {};
  }
}

/** One server read (e.g. diagnostics); modal uses {@link subscribeChinottoUserSyncAccess} for live updates. */
export async function fetchChinottoUserSyncAccessActive(uid: string): Promise<{
  active: boolean;
  permissionDenied: boolean;
}> {
  if (!isFirebaseSyncConfigured() || !uid?.trim()) {
    return { active: false, permissionDenied: false };
  }
  try {
    const db = getOrInitFirestore();
    const ref = doc(db, "users", uid);
    const snap = await getDocFromServer(ref);
    return {
      active: isChinottoSyncAccessActiveInUserDoc(snap.data()),
      permissionDenied: false,
    };
  } catch (e) {
    if (isFirestorePermissionDenied(e)) {
      console.warn(
        `[chinotto sync] fetch user sync access: permission denied — ${FIRESTORE_RULES_SYNC_MODAL_HINT}`,
        e
      );
      return { active: false, permissionDenied: true };
    }
    console.error("[chinotto sync] fetch user sync access failed", e);
    return { active: false, permissionDenied: false };
  }
}
