import { useEffect, useRef, useState } from "react";

import { subscribeChinottoUserSyncAccess } from "./desktopFirestoreSync";

/** Firebase Auth can briefly emit null around WebView lifecycle; avoid clearing sync UI immediately. */
const SYNC_PROFILE_AUTH_CLEAR_MS = 750;

export type ChinottoSyncProfileAccessOptions = {
  onPermissionDenied?: () => void;
  onReadSucceeded?: () => void;
};

/**
 * Live `users/{uid}.chinottoSyncAccess.active` for the main header and Sync modal.
 * Debounces loss of uid so a transient auth gap does not flash “sync off”, and avoids a “Checking sync”
 * flash when the same uid re-subscribes after that gap while access was already known active.
 */
export function useChinottoSyncProfileAccess(
  firebaseConfigured: boolean,
  syncUid: string | null,
  options?: ChinottoSyncProfileAccessOptions
): { profileActive: boolean; profileLoading: boolean } {
  const [profileActive, setProfileActive] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const lastSubscribedUidRef = useRef<string | null>(null);
  const lastProfileActiveRef = useRef(false);
  const authClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!firebaseConfigured) {
      if (authClearTimerRef.current) {
        clearTimeout(authClearTimerRef.current);
        authClearTimerRef.current = null;
      }
      lastSubscribedUidRef.current = null;
      lastProfileActiveRef.current = false;
      setProfileActive(false);
      setProfileLoading(false);
      return;
    }

    if (authClearTimerRef.current) {
      clearTimeout(authClearTimerRef.current);
      authClearTimerRef.current = null;
    }

    if (syncUid == null || syncUid === "") {
      authClearTimerRef.current = setTimeout(() => {
        authClearTimerRef.current = null;
        lastSubscribedUidRef.current = null;
        lastProfileActiveRef.current = false;
        setProfileActive(false);
        setProfileLoading(false);
      }, SYNC_PROFILE_AUTH_CLEAR_MS);
      return () => {
        if (authClearTimerRef.current) {
          clearTimeout(authClearTimerRef.current);
          authClearTimerRef.current = null;
        }
      };
    }

    const uid = syncUid;
    const sameUid = lastSubscribedUidRef.current === uid;
    lastSubscribedUidRef.current = uid;

    if (!sameUid) {
      lastProfileActiveRef.current = false;
      setProfileActive(false);
      setProfileLoading(true);
    } else if (!lastProfileActiveRef.current) {
      setProfileLoading(true);
    }

    return subscribeChinottoUserSyncAccess(
      uid,
      (active) => {
        setProfileActive(active);
        lastProfileActiveRef.current = active;
        setProfileLoading(false);
      },
      optionsRef.current
    );
  }, [firebaseConfigured, syncUid]);

  return { profileActive, profileLoading };
}
