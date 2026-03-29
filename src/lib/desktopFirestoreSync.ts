import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
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
  getDocs,
  getFirestore,
  limit,
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
  type Firestore,
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
  dbSingleton = getFirestore(getOrInitApp());
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
    const q = lastDoc
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

    lastDoc = snap.docs[snap.docs.length - 1]!;
    const { tombstonedIds, activeRows } = partitionFirestoreSnapshotDocs(snap.docs);
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

  const app = getOrInitApp();
  const auth = getAuth(app);
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
    const db = getOrInitFirestore();
    const coll = collection(db, "users", user.uid, "entries");

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
          const { tombstonedIds, activeRows } = partitionFirestoreSnapshotDocs(snap.docs);
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

export async function signInWithAppleCredential(credentialJson: BridgedOAuthCredentialJson): Promise<void> {
  if (!isFirebaseSyncConfigured()) {
    throw new Error("Sync is not configured");
  }
  const idToken = credentialJson.idToken?.trim();
  if (!idToken) {
    throw new Error("Apple sign-in did not provide an ID token");
  }
  const auth = getAuth(getOrInitApp());
  const credential = OAuthProvider.credentialFromJSON({
    ...credentialJson,
    idToken,
    accessToken: credentialJson.accessToken?.trim() ? credentialJson.accessToken : undefined,
  });
  await signInWithCredential(auth, credential);
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
  const auth = getAuth(getOrInitApp());
  return onAuthStateChanged(auth, onChange);
}
