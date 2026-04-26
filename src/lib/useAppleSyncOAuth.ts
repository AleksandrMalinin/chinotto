import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isFirebaseSyncConfigured } from "@/lib/firebaseConfig";
import {
  signInWithAppleCredential,
  signOutFirebaseSync,
  subscribeSyncAuth,
  type BridgedOAuthCredentialJson,
} from "@/lib/desktopFirestoreSync";
import { track } from "@/lib/analytics";
import {
  logOAuthDiagnostic,
  logOAuthUnknownError,
  userMessageFromCredentialApplyError,
  userMessageOAuthTimeoutMainWindow,
} from "@/lib/oauthDiagnostics";

function isTauriShell(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Tauri / plugin failures are not always `Error` with `.message`. */
function extractAppleSyncStartErrorText(e: unknown): string {
  if (e == null) {
    return "";
  }
  if (typeof e === "string") {
    return e.trim();
  }
  if (e instanceof Error && e.message.trim()) {
    return e.message.trim();
  }
  if (typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string" && m.trim()) {
      return m.trim();
    }
  }
  try {
    const s = JSON.stringify(e);
    if (s && s !== "{}" && s !== "null") {
      return s.length > 400 ? `${s.slice(0, 400)}…` : s;
    }
  } catch {
    /* ignore */
  }
  const s = String(e).trim();
  return s.length > 400 ? `${s.slice(0, 400)}…` : s;
}

function messageFromAppleSyncStartFailure(
  e: unknown,
  phase?: "listener" | "browser"
): string {
  const raw = extractAppleSyncStartErrorText(e);
  const prefix =
    phase === "listener" ? "Local helper: " : phase === "browser" ? "Open browser: " : "";

  if (import.meta.env.DEV) {
    return raw ? `${prefix}${raw}` : `${prefix}(no error text — see console)`;
  }

  if (/Not allowed to open url/i.test(raw)) {
    return "The app could not open the sign-in page. Rebuild from the latest sources or check security settings.";
  }
  if (/Permission denied|operation not permitted|Address already in use/i.test(raw)) {
    return "Sign-in could not start (system blocked the local helper). Quit Chinotto fully and try again.";
  }
  if (raw) {
    return "Could not start sign-in. Quit Chinotto fully and try again.";
  }
  return "Could not start sign-in. Quit Chinotto fully and try again.";
}

const OAUTH_TIMEOUT_MS = 4 * 60 * 1000;

type OauthSuccessPayload = { nonce: string; credential: BridgedOAuthCredentialJson };
type OauthErrorPayload = { nonce: string; message: string };

type NativeAppleSignInResult = {
  idToken: string;
  rawNonce: string;
};

type UseAppleSyncOAuthOptions = {
  /** When false, auth subscription is inactive (saves work when modal is closed). */
  active: boolean;
};

/**
 * Apple / Firebase device sync: dev uses Vite + bridge; packaged macOS uses native `native_apple_sign_in` only (no Safari loopback).
 */
export function useAppleSyncOAuth({ active }: UseAppleSyncOAuthOptions) {
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  /** True while disconnect (sign-out) runs; keeps the modal in a short “Disconnecting…” state. */
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflightCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!active || !isFirebaseSyncConfigured()) {
      return undefined;
    }
    return subscribeSyncAuth(setUser);
  }, [active]);

  useEffect(() => {
    return () => {
      inflightCleanupRef.current?.();
      inflightCleanupRef.current = null;
    };
  }, []);

  const onContinueApple = useCallback(async () => {
    setError(null);
    if (!isTauriShell()) {
      setError("Use the Chinotto desktop app to continue.");
      return;
    }

    inflightCleanupRef.current?.();
    inflightCleanupRef.current = null;

    const nonce = crypto.randomUUID();
    try {
      localStorage.setItem("chinotto_oauth_nonce", nonce);
    } catch {
      /* ignore */
    }
    setBusy(true);

    const unlisteners: UnlistenFn[] = [];
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function cleanup() {
      if (timeoutId != null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      for (const u of unlisteners) {
        try {
          u();
        } catch {
          /* ignore */
        }
      }
      unlisteners.length = 0;
      inflightCleanupRef.current = null;
    }

    inflightCleanupRef.current = cleanup;

    const unSuccess = await listen<OauthSuccessPayload>("chinotto-sync-oauth-success", async (event) => {
      if (event.payload.nonce !== nonce) {
        return;
      }
      cleanup();
      try {
        await signInWithAppleCredential(event.payload.credential);
        track({ event: "sync_oauth_completed" });
      } catch (e) {
        track({ event: "sync_oauth_failed", reason: "credential" });
        setError(userMessageFromCredentialApplyError(e));
      } finally {
        setBusy(false);
      }
    });
    unlisteners.push(unSuccess);

    const unErr = await listen<OauthErrorPayload>("chinotto-sync-oauth-error", (event) => {
      if (event.payload.nonce !== nonce) {
        return;
      }
      cleanup();
      track({ event: "sync_oauth_failed", reason: "oauth_bridge" });
      setError(event.payload.message);
      setBusy(false);
    });
    unlisteners.push(unErr);

    timeoutId = setTimeout(() => {
      cleanup();
      try {
        localStorage.removeItem("chinotto_oauth_nonce");
      } catch {
        /* ignore */
      }
      setBusy(false);
      logOAuthDiagnostic("timeout", "main_window_listen_timeout", {
        message: `no success/error event within ${OAUTH_TIMEOUT_MS}ms`,
      });
      track({ event: "sync_oauth_failed", reason: "timeout" });
      setError(userMessageOAuthTimeoutMainWindow(import.meta.env.DEV));
    }, OAUTH_TIMEOUT_MS);

    try {
      if (import.meta.env.DEV) {
        const returnUrl = new URL(window.location.href);
        returnUrl.pathname = "/chinotto-oauth";
        returnUrl.search = "";
        returnUrl.hash = "";
        returnUrl.searchParams.set("nonce", nonce);
        const bridgeSecret = crypto.randomUUID();
        const bridgePort = await invoke<number>("start_oauth_dev_bridge_listener", {
          args: { secret: bridgeSecret },
        });
        returnUrl.searchParams.set("oauthDevBridge", "1");
        returnUrl.searchParams.set("oauthDevBridgePort", String(bridgePort));
        returnUrl.searchParams.set("oauthDevBridgeSecret", bridgeSecret);
        await openUrl(returnUrl.toString());
      } else {
        try {
          const out = await invoke<NativeAppleSignInResult>("native_apple_sign_in");
          cleanup();
          try {
            localStorage.removeItem("chinotto_oauth_nonce");
          } catch {
            /* ignore */
          }
          await signInWithAppleCredential({
            providerId: "apple.com",
            signInMethod: "apple.com",
            idToken: out.idToken,
            nonce: out.rawNonce,
          });
          track({ event: "sync_oauth_completed" });
          setBusy(false);
          return;
        } catch (nativeErr) {
          cleanup();
          try {
            localStorage.removeItem("chinotto_oauth_nonce");
          } catch {
            /* ignore */
          }
          track({ event: "sync_oauth_failed", reason: "start" });
          logOAuthUnknownError("onContinueApple_native_apple_sign_in", nativeErr);
          console.warn("[Chinotto sync oauth] native_apple_sign_in failed", nativeErr);
          setError(messageFromAppleSyncStartFailure(nativeErr));
          setBusy(false);
          return;
        }
      }
    } catch (e) {
      cleanup();
      track({ event: "sync_oauth_failed", reason: "start" });
      logOAuthUnknownError("onContinueApple", e);
      console.warn("[Chinotto sync oauth] start failed", e);
      setError(messageFromAppleSyncStartFailure(e));
      setBusy(false);
    }
  }, []);

  const onSignOut = useCallback(async () => {
    setError(null);
    setSigningOut(true);
    setBusy(true);
    try {
      await signOutFirebaseSync();
      /* onAuthStateChanged can lag; update UI immediately so the modal leaves the connected state. */
      setUser(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setBusy(false);
      setSigningOut(false);
    }
  }, []);

  const stable = user != null && !user.isAnonymous;

  return {
    user,
    stable,
    busy,
    signingOut,
    error,
    setError,
    onContinueApple,
    onSignOut,
  };
}
