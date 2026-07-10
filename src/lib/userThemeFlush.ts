import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { deleteField, doc, initializeFirestore, memoryLocalCache, serverTimestamp, setDoc } from "firebase/firestore";

import { getFirebaseWebOptions, isFirebaseSyncConfigured } from "./firebaseConfig";
import {
  clearUserThemeIngestSuppression,
  listSyncUserThemeOutbox,
  removeSyncUserThemeOutbox,
} from "./themeSyncApi";

function getOrInitApp() {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(getFirebaseWebOptions());
}

function getOrInitFirestore() {
  return initializeFirestore(getOrInitApp(), {
    localCache: memoryLocalCache(),
  });
}

async function firebasePushUserThemeUpsert(
  themeId: string,
  label: string,
  sortOrder: number
): Promise<void> {
  const auth = getAuth(getOrInitApp());
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    throw new Error("Firebase Auth has no user");
  }
  const db = getOrInitFirestore();
  const ref = doc(db, "users", user.uid, "user_themes", themeId);
  await setDoc(
    ref,
    {
      label,
      sortOrder,
      updatedAt: serverTimestamp(),
      deletedAt: deleteField(),
    },
    { merge: true }
  );
}

async function firebaseApplyUserThemeTombstone(themeId: string): Promise<void> {
  const auth = getAuth(getOrInitApp());
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    throw new Error("Firebase Auth has no user");
  }
  const db = getOrInitFirestore();
  const ref = doc(db, "users", user.uid, "user_themes", themeId);
  await setDoc(ref, { deletedAt: serverTimestamp() }, { merge: true });
}

/** Flush durable user-theme outbox to Firestore. Best-effort; failures leave rows pending. */
export async function flushSyncUserThemeOutbox(): Promise<void> {
  if (!isFirebaseSyncConfigured()) {
    return;
  }
  const auth = getAuth(getOrInitApp());
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    return;
  }
  const rows = await listSyncUserThemeOutbox();
  for (const row of rows) {
    try {
      if (row.op === "tombstone") {
        await firebaseApplyUserThemeTombstone(row.themeId);
      } else {
        const label = row.label?.trim() ?? "";
        if (!label || row.sortOrder == null) {
          await removeSyncUserThemeOutbox(row.themeId);
          continue;
        }
        await firebasePushUserThemeUpsert(row.themeId, label, row.sortOrder);
      }
      await removeSyncUserThemeOutbox(row.themeId);
      await clearUserThemeIngestSuppression(row.themeId);
    } catch (e: unknown) {
      if (import.meta.env.DEV) {
        console.warn("[chinotto sync] user theme flush failed, will retry", row.themeId, e);
      }
    }
  }
}
