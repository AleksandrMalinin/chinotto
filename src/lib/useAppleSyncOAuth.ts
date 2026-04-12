import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
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

const OAUTH_WINDOW_LABEL = "chinotto-oauth";
const OAUTH_TIMEOUT_MS = 4 * 60 * 1000;

type OauthSuccessPayload = { nonce: string; credential: BridgedOAuthCredentialJson };
type OauthErrorPayload = { nonce: string; message: string };

type UseAppleSyncOAuthOptions = {
  /** When false, auth subscription is inactive (saves work when modal is closed). */
  active: boolean;
};

/**
 * Apple / Firebase device sync: auth state and opening the OAuth webview or dev browser tab.
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
      void WebviewWindow.getByLabel(OAUTH_WINDOW_LABEL).then((w) => w?.close().catch(() => {}));
    }, OAUTH_TIMEOUT_MS);

    try {
      const returnUrl = new URL(window.location.href);
      returnUrl.pathname = "/chinotto-oauth";
      returnUrl.search = "";
      returnUrl.hash = "";
      returnUrl.searchParams.set("nonce", nonce);

      if (import.meta.env.DEV) {
        const bridgeSecret = crypto.randomUUID();
        const bridgePort = await invoke<number>("start_oauth_dev_bridge_listener", {
          secret: bridgeSecret,
        });
        returnUrl.searchParams.set("oauthDevBridge", "1");
        returnUrl.searchParams.set("oauthDevBridgePort", String(bridgePort));
        returnUrl.searchParams.set("oauthDevBridgeSecret", bridgeSecret);
        await openUrl(returnUrl.toString());
      } else {
        const existing = await WebviewWindow.getByLabel(OAUTH_WINDOW_LABEL);
        if (existing) {
          await existing.close();
        }
        const oauthWin = new WebviewWindow(OAUTH_WINDOW_LABEL, {
          url: returnUrl.toString(),
          width: 480,
          height: 720,
          center: true,
          title: "Continue with Apple",
          resizable: true,
        });
        const unOnceErr = await oauthWin.once("tauri://error", (e) => {
          cleanup();
          track({ event: "sync_oauth_failed", reason: "window" });
          const payload =
            typeof e === "object" && e !== null && "payload" in e
              ? String((e as { payload: unknown }).payload)
              : "Could not open the Apple window.";
          logOAuthDiagnostic("popup_redirect", "oauth_webview_failed_to_open", {
            message: payload,
          });
          setError("Could not open the Apple window. Quit Chinotto fully and try again.");
          setBusy(false);
        });
        unlisteners.push(unOnceErr);
      }
    } catch (e) {
      cleanup();
      track({ event: "sync_oauth_failed", reason: "start" });
      logOAuthUnknownError("onContinueApple", e);
      setError("Could not start this step. Quit Chinotto fully and try again.");
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
