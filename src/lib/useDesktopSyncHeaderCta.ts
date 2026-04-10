import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";

import { isFirebaseSyncConfigured } from "./firebaseConfig";
import {
  subscribeChinottoUserSyncAccess,
  subscribeSyncAuth,
} from "./desktopFirestoreSync";

export type DesktopSyncHeaderCta = {
  label: string;
  ariaLabel: string;
  /** Lavender dot before label — parity with mobile sync header (`restoring` / `signed_in`). */
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
  /** Same idea as mobile `showDot`: restoring or signed in (non-anonymous). */
  const showDot =
    firebaseConfigured && (!authReady || signedInNonAnonymous);
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
  const [profileActive, setProfileActive] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

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

  useEffect(() => {
    if (!firebaseConfigured) {
      return;
    }
    const u = authUser;
    if (u == null || u.isAnonymous) {
      setProfileLoading(false);
      setProfileActive(false);
      return undefined;
    }
    setProfileLoading(true);
    return subscribeChinottoUserSyncAccess(u.uid, (active) => {
      setProfileActive(active);
      setProfileLoading(false);
    });
  }, [firebaseConfigured, authUser?.uid, authUser?.isAnonymous]);

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
