import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";

import { isFirebaseSyncConfigured } from "./firebaseConfig";
import { subscribeSyncAuth } from "./desktopFirestoreSync";
import { useChinottoSyncProfileAccess } from "./useChinottoSyncProfileAccess";

export type DesktopSyncHeaderCta = {
  label: string;
  ariaLabel: string;
  /** Lavender dot before label — only when cloud sync is on (`chinottoSyncAccess.active`). */
  showDot: boolean;
};

/**
 * Pure copy for tests — mirrors mobile header: Checking → Sync on vs Enable sync.
 */
export function getDesktopSyncHeaderCtaCopy(params: {
  firebaseConfigured: boolean;
  authReady: boolean;
  signedInNonAnonymous: boolean;
  profileLoading: boolean;
  profileActive: boolean;
}): DesktopSyncHeaderCta {
  const { firebaseConfigured, authReady, signedInNonAnonymous, profileLoading, profileActive } =
    params;
  const showDot = firebaseConfigured && profileActive;
  if (!firebaseConfigured) {
    return {
      label: "Enable sync",
      ariaLabel: "Enable sync — continue on your phone",
      showDot: false,
    };
  }
  if (!authReady) {
    return {
      label: "Checking sync",
      ariaLabel: "Checking sync status",
      showDot,
    };
  }
  if (!signedInNonAnonymous) {
    return {
      label: "Enable sync",
      ariaLabel: "Enable sync — continue on your phone",
      showDot: false,
    };
  }
  if (profileLoading) {
    return {
      label: "Checking sync",
      ariaLabel: "Checking sync status",
      showDot,
    };
  }
  if (profileActive) {
    return {
      label: "Sync on",
      ariaLabel: "Cloud sync on — open sync settings",
      showDot,
    };
  }
  return {
    label: "Enable sync",
    ariaLabel: "Finish enabling sync on your phone",
    showDot,
  };
}

/**
 * Header CTA label for main window — same signals as {@link SyncModal} (auth + `chinottoSyncAccess` / entries fallback).
 */
export function useDesktopSyncHeaderCta(): DesktopSyncHeaderCta {
  const [firebaseConfigured] = useState(() => isFirebaseSyncConfigured());
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!firebaseConfigured) {
      setAuthReady(true);
      return;
    }
    return subscribeSyncAuth((user) => {
      setAuthUser(user);
      setAuthReady(true);
    });
  }, [firebaseConfigured]);

  const syncUid =
    firebaseConfigured && authUser && !authUser.isAnonymous ? authUser.uid : null;
  const { profileActive, profileLoading } = useChinottoSyncProfileAccess(
    firebaseConfigured,
    syncUid
  );

  return useMemo(
    () =>
      getDesktopSyncHeaderCtaCopy({
        firebaseConfigured,
        authReady,
        signedInNonAnonymous: Boolean(authUser && !authUser.isAnonymous),
        profileLoading,
        profileActive,
      }),
    [firebaseConfigured, authReady, authUser, profileLoading, profileActive]
  );
}
