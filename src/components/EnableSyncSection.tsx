import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Button } from "@/components/ui/button";
import { isFirebaseSyncConfigured } from "@/lib/firebaseConfig";
import {
  signInWithAppleCredential,
  signOutFirebaseSync,
  subscribeSyncAuth,
  type BridgedOAuthCredentialJson,
} from "@/lib/desktopFirestoreSync";
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

export function EnableSyncSection() {
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseSyncConfigured()) {
      return undefined;
    }
    return subscribeSyncAuth(setUser);
  }, []);

  if (!isFirebaseSyncConfigured()) {
    return null;
  }

  const stable = user != null && !user.isAnonymous;

  async function onContinueApple() {
    setError(null);
    if (!isTauriShell()) {
      setError("Sign in with Apple works in the Chinotto desktop app (Tauri), not in a plain browser tab.");
      return;
    }

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
    }

    const unSuccess = await listen<OauthSuccessPayload>("chinotto-sync-oauth-success", async (event) => {
      if (event.payload.nonce !== nonce) {
        return;
      }
      cleanup();
      try {
        await signInWithAppleCredential(event.payload.credential);
      } catch (e) {
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
          title: "Sign in with Apple",
          resizable: true,
        });
        const unOnceErr = await oauthWin.once("tauri://error", (e) => {
          cleanup();
          const payload =
            typeof e === "object" && e !== null && "payload" in e
              ? String((e as { payload: unknown }).payload)
              : "Could not open the sign-in window.";
          logOAuthDiagnostic("popup_redirect", "oauth_webview_failed_to_open", {
            message: payload,
          });
          setError(
            "Could not open the sign-in window. Quit Chinotto fully and try again."
          );
          setBusy(false);
        });
        unlisteners.push(unOnceErr);
      }
    } catch (e) {
      cleanup();
      logOAuthUnknownError("onContinueApple", e);
      setError("Could not start sign-in. Quit Chinotto fully and try again.");
      setBusy(false);
    }
  }

  async function onSignOut() {
    setError(null);
    setBusy(true);
    try {
      await signOutFirebaseSync();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="chinotto-card-section" aria-labelledby="chinotto-card-sync-title">
      <h2 id="chinotto-card-sync-title" className="chinotto-card-section-title">
        Enable sync
      </h2>
      <p className="chinotto-card-section-desc">
        Use Apple to connect your devices. Chinotto does not create its own account. Entries from your
        phone appear here when you use the same Apple ID and Firebase project.
        {import.meta.env.DEV
          ? " In dev, your default browser opens for Apple sign-in (the in-app webview cannot finish Firebase reliably); return to Chinotto after you see “Signed in”."
          : " A small window opens for Apple; the main app stays put."}
      </p>
      {stable ? (
        <>
          <p className="chinotto-card-section-desc" style={{ marginTop: "0.5rem" }}>
            Sync is on. New entries from mobile will show up in your stream.
          </p>
          <button
            type="button"
            className="chinotto-card-privacy-link"
            style={{ marginTop: "0.75rem" }}
            disabled={busy}
            onClick={() => void onSignOut()}
          >
            Disconnect Apple
          </button>
        </>
      ) : (
        <Button
          type="button"
          className="analytics-optin-btn-primary mt-3 w-full"
          disabled={busy}
          onClick={() => void onContinueApple()}
        >
          Continue with Apple
        </Button>
      )}
      {error ? (
        <p className="chinotto-card-section-desc" style={{ marginTop: "0.5rem", color: "var(--landing-muted)" }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
