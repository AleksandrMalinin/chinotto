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
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getFirebaseWebOptions, isFirebaseSyncConfigured } from "./firebaseConfig";
import { ingestFirestoreEntries } from "@/features/entries/entryApi";

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

function normalizeCreatedAt(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

function snapshotDocsToRows(docs: QueryDocumentSnapshot<DocumentData>[]): SyncIngestRow[] {
  const out: SyncIngestRow[] = [];
  for (const doc of docs) {
    const data = doc.data();
    const text = typeof data.text === "string" ? data.text.trim() : "";
    if (!text) {
      continue;
    }
    const createdAt = normalizeCreatedAt(data.createdAt);
    if (!createdAt) {
      continue;
    }
    out.push({ id: doc.id, text, createdAt });
  }
  return out;
}

/**
 * Subscribe to auth + Firestore `users/{uid}/entries` (SYNC.md §3).
 * Only runs when user is signed in and not anonymous (stable identity, same as mobile).
 * Calls `onIngested` after at least one new row was inserted locally.
 */
export function startDesktopFirestoreIngest(onIngested: () => void): () => void {
  if (!isFirebaseSyncConfigured()) {
    return () => {};
  }

  const app = getOrInitApp();
  const auth = getAuth(app);
  let unsubFirestore: (() => void) | undefined;

  const unsubAuth = onAuthStateChanged(auth, (user) => {
    unsubFirestore?.();
    unsubFirestore = undefined;
    if (!user || user.isAnonymous) {
      return;
    }
    const db = getOrInitFirestore();
    const q = query(
      collection(db, "users", user.uid, "entries"),
      orderBy("createdAt", "desc"),
      limit(INGEST_PAGE_SIZE)
    );
    unsubFirestore = onSnapshot(
      q,
      async (snap) => {
        const rows = snapshotDocsToRows(snap.docs);
        if (rows.length === 0) {
          return;
        }
        try {
          const inserted = await ingestFirestoreEntries(rows);
          if (inserted > 0) {
            onIngested();
          }
        } catch (e) {
          if (import.meta.env.DEV) {
            console.error("[chinotto sync] ingest failed", e);
          }
        }
      },
      (err) => {
        if (import.meta.env.DEV) {
          console.error("[chinotto sync] snapshot error", err);
        }
      }
    );
  });

  return () => {
    unsubFirestore?.();
    unsubAuth();
  };
}

/**
 * Completes Apple sign-in on the **main** window after the auxiliary OAuth webview finishes redirect.
 * Uses `OAuthProvider.credentialFromJSON` so `nonce` / `pendingToken` match what Firebase expects;
 * rebuilding from `{ idToken, accessToken }` alone can trigger `auth/argument-error` when the Apple
 * ID token includes a nonce claim.
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
  const credential = OAuthProvider.credentialFromJSON({
    ...credentialJson,
    idToken,
    accessToken: credentialJson.accessToken?.trim() ? credentialJson.accessToken : undefined,
  });
  await signInWithCredential(auth, credential);
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
