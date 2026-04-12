import { useCallback, useEffect, useRef, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { Auth, UserCredential } from "firebase/auth";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  getRedirectResult,
  initializeAuth,
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import type { BridgedOAuthCredentialJson } from "@/lib/desktopFirestoreSync";
import { getFirebaseWebOptions, isFirebaseSyncConfigured } from "@/lib/firebaseConfig";
import type { OAuthDiagnosticCategory } from "@/lib/oauthDiagnostics";
import {
  logOAuthDiagnostic,
  logOAuthUnknownError,
  oauthErrorCategoryFromCode,
  parseFirebaseAuthError,
  userMessageAuthNotReady,
  userMessageFromFirebasePopupOrRedirect,
  userMessageRedirectIncomplete,
  userMessageRedirectTimeout,
  userMessageSyncNotConfigured,
  userMessageTauriOAuthPopupOnly,
} from "@/lib/oauthDiagnostics";
import type { FirebaseApp } from "firebase/app";
import { getApp, getApps, initializeApp } from "firebase/app";

const NONCE_STORAGE_KEY = "chinotto_oauth_nonce";
/** Survives Firebase stripping `?nonce=` from the return URL (same webview session). */
const SESSION_NONCE_KEY = "chinotto_oauth_nonce_session";
/** Set right before signInWithRedirect so we can tell “returned from Apple” from “first load”. */
const FIREBASE_REDIRECT_PENDING_KEY = "chinotto_oauth_firebase_redirect_pending";
/** Firebase redirect return URL often drops `?oauthDevBridgePort=` / `oauthDevBridgeSecret=`; keep them for the POST back to Tauri. */
const SESSION_DEV_BRIDGE_KEY = "chinotto_oauth_dev_bridge";

type DevBridgeSession = { port: string; secret: string };

function syncDevBridgeSessionFromUrl(): void {
  try {
    const p = new URLSearchParams(window.location.search);
    if (p.get("oauthDevBridge") !== "1") {
      return;
    }
    const port = p.get("oauthDevBridgePort")?.trim();
    const secret = p.get("oauthDevBridgeSecret")?.trim();
    if (!port || !secret) {
      return;
    }
    sessionStorage.setItem(
      SESSION_DEV_BRIDGE_KEY,
      JSON.stringify({ port, secret } satisfies DevBridgeSession)
    );
  } catch {
    /* ignore */
  }
}

function getDevBridgeSession(): DevBridgeSession | null {
  if (typeof window === "undefined" || "__TAURI_INTERNALS__" in window) {
    return null;
  }
  try {
    syncDevBridgeSessionFromUrl();
    const raw = sessionStorage.getItem(SESSION_DEV_BRIDGE_KEY);
    if (!raw) {
      return null;
    }
    const o = JSON.parse(raw) as DevBridgeSession;
    if (typeof o.port === "string" && o.port && typeof o.secret === "string" && o.secret) {
      return o;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function clearDevBridgeSession(): void {
  try {
    sessionStorage.removeItem(SESSION_DEV_BRIDGE_KEY);
  } catch {
    /* ignore */
  }
}

/** OAuth bridge runs inside the auxiliary Tauri webview (not the Safari dev-browser flow). */
function isTauriOAuthWebview(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Firebase stores redirect pending state under this sessionStorage key (see @firebase/auth
 * `pendingRedirectKey`). WKWebView sometimes drops it on the Apple round-trip while our
 * `FIREBASE_REDIRECT_PENDING_KEY` still reads "1". Reseed before Auth initializes so the first
 * `getRedirectResult` inside `_initializationPromise` can complete the flow.
 */
function reseedFirebaseRedirectPendingIfBridgeSaysSo(apiKey: string, appName: string): void {
  try {
    if (sessionStorage.getItem(FIREBASE_REDIRECT_PENDING_KEY) !== "1") {
      return;
    }
    const firebasePendingKey = `firebase:pendingRedirect:${apiKey}:${appName}`;
    if (sessionStorage.getItem(firebasePendingKey) != null) {
      return;
    }
    sessionStorage.setItem(firebasePendingKey, JSON.stringify("true"));
  } catch {
    /* ignore */
  }
}

/**
 * IndexedDB redirect state is often lost in Tauri’s OAuth webview; localStorage helps.
 * `initializeAuth` without `popupRedirectResolver` leaves redirect APIs unusable (`auth/argument-error`).
 */
function authForOAuthWebview(app: FirebaseApp): Auth {
  try {
    return initializeAuth(app, {
      persistence: browserLocalPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "auth/already-initialized") {
      return getAuth(app);
    }
    throw e;
  }
}

function isBrowserDevOauthBridge(): boolean {
  return getDevBridgeSession() != null;
}

/** Safari dev-bridge: plain DOM after `replaceChildren`; flex centers copy horizontally and vertically. */
function showDevBridgeSafariPage(message: string): void {
  try {
    document.documentElement.style.minHeight = "100%";
    document.documentElement.style.background = "#0a0a0e";
  } catch {
    /* ignore */
  }
  document.body.replaceChildren();
  document.body.style.cssText =
    "min-height:100vh;margin:0;background:#0a0a0e;display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;padding:1.5rem;";
  const p = document.createElement("p");
  p.style.cssText =
    "font-family:system-ui,-apple-system,sans-serif;margin:0;max-width:28rem;width:100%;color:#e4e4e9;text-align:center;line-height:1.5;font-size:15px;";
  p.textContent = message;
  document.body.appendChild(p);
}

function readNonce(): string | null {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get("nonce");
    if (fromQuery) {
      sessionStorage.setItem(SESSION_NONCE_KEY, fromQuery);
      return fromQuery;
    }
    const cached = sessionStorage.getItem(SESSION_NONCE_KEY);
    if (cached) {
      return cached;
    }
    return localStorage.getItem(NONCE_STORAGE_KEY);
  } catch {
    return null;
  }
}

async function closeOAuthWindow(): Promise<void> {
  try {
    await getCurrentWebviewWindow().close();
  } catch {
    /* user may close manually */
  }
}

async function oauthBridgeEmitError(
  nonce: string,
  message: string,
  diagnostic?: {
    category: OAuthDiagnosticCategory;
    code?: string;
    detailMessage?: string;
    extra?: Record<string, unknown>;
  }
): Promise<void> {
  logOAuthDiagnostic(diagnostic?.category ?? "unknown", "bridge_error", {
    code: diagnostic?.code,
    message: diagnostic?.detailMessage ?? message,
    extra: {
      ...diagnostic?.extra,
      noncePrefix: nonce.slice(0, 8),
      surface: isBrowserDevOauthBridge() ? "safari_dev_bridge" : "tauri_webview",
    },
  });
  if (isBrowserDevOauthBridge()) {
    clearDevBridgeSession();
    showDevBridgeSafariPage(message);
    return;
  }
  await emit("chinotto-sync-oauth-error", { nonce, message });
  await closeOAuthWindow();
}

const AUTH_READY_BEFORE_REDIRECT_MS = 10_000;
const GET_REDIRECT_RESULT_TIMEOUT_MS = 18_000;

function rejectAfter(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * `getRedirectResult` can hang indefinitely in some embedded WebViews (never settles).
 * Without a timeout the UI stays on the initial message forever.
 */
async function getRedirectResultOrTimeout(auth: Auth) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const fromFirebase = getRedirectResult(auth, browserPopupRedirectResolver).catch((e: unknown) => {
    const { code } = parseFirebaseAuthError(e);
    if (code === "auth/no-auth-event") {
      return null;
    }
    logOAuthUnknownError("getRedirectResult", e);
    throw e;
  });

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      logOAuthDiagnostic("timeout", "getRedirectResult", {
        message: `no result within ${GET_REDIRECT_RESULT_TIMEOUT_MS}ms`,
      });
      reject(new Error(userMessageRedirectTimeout()));
    }, GET_REDIRECT_RESULT_TIMEOUT_MS);
  });

  try {
    return await Promise.race([fromFirebase, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Minimal entry shown only in the auxiliary Tauri webview: runs Firebase redirect flow,
 * then forwards credentials to the main window via Tauri event and closes itself.
 */
type BridgeActions = {
  oauthNonce: string;
  getCancelled: () => boolean;
  startAppleSignIn: () => Promise<"redirected" | void>;
};

export function OAuthBridge() {
  const [status, setStatus] = useState("Starting sign-in…");
  const [showContinueButton, setShowContinueButton] = useState(false);
  const [busy, setBusy] = useState(false);
  const actionsRef = useRef<BridgeActions | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const onContinueClick = useCallback(async () => {
    const a = actionsRef.current;
    if (!a || a.getCancelled()) {
      return;
    }
    setBusy(true);
    setShowContinueButton(false);
    try {
      const redirecting = await a.startAppleSignIn();
      if (a.getCancelled()) {
        return;
      }
      if (redirecting === "redirected") {
        return;
      }
    } catch (e) {
      if (a.getCancelled()) {
        return;
      }
      const msg = userMessageFromFirebasePopupOrRedirect(e, { log: false });
      const parsed = parseFirebaseAuthError(e);
      await oauthBridgeEmitError(a.oauthNonce, msg, {
        category: oauthErrorCategoryFromCode(parsed.code),
        code: parsed.code || undefined,
        detailMessage: parsed.message,
      });
    } finally {
      if (mountedRef.current) {
        setBusy(false);
      }
    }
  }, []);

  useEffect(() => {
    syncDevBridgeSessionFromUrl();
    const nonce = readNonce();
    if (!nonce) {
      setStatus("Missing session. Close this window and try again from Chinotto.");
      return;
    }

    setStatus("Checking sign-in state…");

    let cancelled = false;

    async function run() {
      if (nonce == null || nonce === "") {
        return;
      }
      const oauthNonce = nonce;

      if (!isFirebaseSyncConfigured()) {
        await oauthBridgeEmitError(oauthNonce, userMessageSyncNotConfigured(), {
          category: "config",
          detailMessage: "isFirebaseSyncConfigured() false",
        });
        return;
      }

      const firebaseOptions = getFirebaseWebOptions();
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseOptions);
      const browserDevBridge = isBrowserDevOauthBridge();
      if (!browserDevBridge) {
        reseedFirebaseRedirectPendingIfBridgeSaysSo(firebaseOptions.apiKey, app.name);
      }
      const auth = authForOAuthWebview(app);
      const provider = new OAuthProvider("apple.com");

      function clearOAuthPending(): void {
        try {
          sessionStorage.removeItem(FIREBASE_REDIRECT_PENDING_KEY);
        } catch {
          /* ignore */
        }
      }

      async function finishWithUserCredential(result: UserCredential): Promise<void> {
        clearOAuthPending();
        try {
          sessionStorage.removeItem(SESSION_NONCE_KEY);
        } catch {
          /* ignore */
        }
        const cred = OAuthProvider.credentialFromResult(result);
        if (!cred) {
          await oauthBridgeEmitError(
            oauthNonce,
            "Apple sign-in did not return a credential. Try again; if it repeats, clear Safari website data for Firebase and Apple.",
            {
              category: "unknown",
              detailMessage: "OAuthProvider.credentialFromResult returned null",
            }
          );
          return;
        }
        const credential = cred.toJSON() as BridgedOAuthCredentialJson;
        if (!credential.idToken?.trim()) {
          await oauthBridgeEmitError(
            oauthNonce,
            "Apple sign-in did not return an ID token. Try again; if it repeats, clear Safari website data for Firebase and Apple.",
            {
              category: "config",
              detailMessage: "missing idToken on credential JSON",
            }
          );
          return;
        }
        const devBridge = getDevBridgeSession();
        if (devBridge) {
          const { port, secret } = devBridge;
          try {
            const r = await fetch(`http://127.0.0.1:${port}/chinotto-oauth-bridge`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Chinotto-OAuth-Secret": secret,
              },
              body: JSON.stringify({ nonce: oauthNonce, credential }),
            });
            if (!r.ok) {
              const detail = (await r.text()).slice(0, 500);
              logOAuthDiagnostic("network", "dev_bridge_POST_failed", {
                message: `HTTP ${r.status}`,
                extra: { detail },
              });
              clearDevBridgeSession();
              showDevBridgeSafariPage(
                "Could not hand sign-in back to Chinotto. Quit the app completely and try again. Details: browser console → [Chinotto OAuth]."
              );
              return;
            }
            showDevBridgeSafariPage("Signed in. Close this tab and return to Chinotto.");
            clearDevBridgeSession();
          } catch (e) {
            logOAuthUnknownError("dev_bridge_POST_fetch", e);
            showDevBridgeSafariPage(
              "Could not hand sign-in back to Chinotto. Quit the app completely and try again. Details: browser console → [Chinotto OAuth]."
            );
            clearDevBridgeSession();
          }
          try {
            localStorage.removeItem(NONCE_STORAGE_KEY);
          } catch {
            /* ignore */
          }
          return;
        }
        await emit("chinotto-sync-oauth-success", {
          nonce: oauthNonce,
          credential,
        });
        try {
          localStorage.removeItem(NONCE_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        await closeOAuthWindow();
      }

      async function startAppleSignIn(): Promise<"redirected" | void> {
        setStatus("Opening Apple…");
        await Promise.race([
          auth.authStateReady(),
          rejectAfter(AUTH_READY_BEFORE_REDIRECT_MS, userMessageAuthNotReady()),
        ]);
        if (cancelled) {
          return;
        }
        try {
          const popupResult = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
          if (cancelled) {
            return;
          }
          await finishWithUserCredential(popupResult);
          return;
        } catch (e: unknown) {
          const code =
            e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
          if (
            code === "auth/popup-blocked" ||
            code === "auth/operation-not-supported-in-this-environment"
          ) {
            if (isTauriOAuthWebview()) {
              logOAuthDiagnostic("popup_redirect", "redirect_fallback_skipped_tauri_webview", {
                code: code || undefined,
                message:
                  "signInWithRedirect loses sessionStorage in WKWebView; user must use signInWithPopup after a tap",
              });
              throw new Error(userMessageTauriOAuthPopupOnly());
            }
            try {
              sessionStorage.setItem(FIREBASE_REDIRECT_PENDING_KEY, "1");
            } catch {
              /* ignore */
            }
            setStatus("Continue in this window to sign in with Apple…");
            await signInWithRedirect(auth, provider, browserPopupRedirectResolver);
            return "redirected";
          }
          throw e;
        }
      }

      actionsRef.current = {
        oauthNonce,
        getCancelled: () => cancelled,
        startAppleSignIn,
      };

      setStatus(browserDevBridge ? "Checking for a completed sign-in…" : "Completing sign-in…");
      try {
        const redirectBackResult = await getRedirectResultOrTimeout(auth);
        if (cancelled) {
          return;
        }
        if (redirectBackResult) {
          await finishWithUserCredential(redirectBackResult);
          return;
        }

        let redirectAlreadyStarted = false;
        try {
          redirectAlreadyStarted = sessionStorage.getItem(FIREBASE_REDIRECT_PENDING_KEY) === "1";
        } catch {
          /* ignore */
        }
        if (redirectAlreadyStarted && browserDevBridge) {
          logOAuthDiagnostic("stale_session", "redirect_pending_but_no_redirect_result_recover_ui", {
            extra: {
              origin: typeof window !== "undefined" ? window.location.origin : "",
              note: "Safari often blocks popup from useEffect; offering user-gesture sign-in instead of hard error",
            },
          });
          clearOAuthPending();
          setStatus(
            "The last sign-in did not complete in this tab. Tap Continue with Apple—your browser only allows the sign-in window after a tap here."
          );
          setShowContinueButton(true);
          return;
        }
        if (redirectAlreadyStarted && !browserDevBridge) {
          if (isTauriOAuthWebview()) {
            logOAuthDiagnostic("stale_session", "redirect_pending_recover_tauri_popup_only", {
              extra: {
                origin: typeof window !== "undefined" ? window.location.origin : "",
                note: "prior redirect flow unreliable in webview; offer tap + popup",
              },
            });
            clearOAuthPending();
            setStatus(
              "The last sign-in used a path this window can’t finish. Tap Continue with Apple to try again."
            );
            setShowContinueButton(true);
            return;
          }
          logOAuthDiagnostic("stale_session", "redirect_pending_but_no_redirect_result", {
            extra: {
              origin: typeof window !== "undefined" ? window.location.origin : "",
              browserDevBridge: false,
              note: "getRedirectResult returned null; chinotto_oauth_firebase_redirect_pending was set",
            },
          });
          clearOAuthPending();
          try {
            localStorage.removeItem(NONCE_STORAGE_KEY);
            sessionStorage.removeItem(SESSION_NONCE_KEY);
          } catch {
            /* ignore */
          }
          await oauthBridgeEmitError(oauthNonce, userMessageRedirectIncomplete(false), {
            category: "stale_session",
            detailMessage: "redirect_pending_but_no_redirect_result",
          });
          return;
        }

        if (browserDevBridge) {
          setStatus(
            "Tap Continue with Apple. Safari requires this tap so the sign-in window can open (automatic start is blocked)."
          );
          setShowContinueButton(true);
          return;
        }

        if (isTauriOAuthWebview()) {
          setStatus("Tap Continue with Apple to sign in.");
          setShowContinueButton(true);
          return;
        }

        try {
          const redirecting = await startAppleSignIn();
          if (cancelled) {
            return;
          }
          if (redirecting === "redirected") {
            return;
          }
        } catch (e) {
          const msg = userMessageFromFirebasePopupOrRedirect(e, { log: false });
          clearOAuthPending();
          try {
            localStorage.removeItem(NONCE_STORAGE_KEY);
            sessionStorage.removeItem(SESSION_NONCE_KEY);
          } catch {
            /* ignore */
          }
          const parsed = parseFirebaseAuthError(e);
          await oauthBridgeEmitError(oauthNonce, msg, {
            category: oauthErrorCategoryFromCode(parsed.code),
            code: parsed.code || undefined,
            detailMessage: parsed.message,
          });
          return;
        }
      } catch (e) {
        clearOAuthPending();
        const parsed = parseFirebaseAuthError(e);
        const isTimeout =
          parsed.message.includes("timed out") || parsed.message.includes("Sign-in timed out");
        const msg =
          isTimeout && parsed.code === ""
            ? parsed.message
            : userMessageFromFirebasePopupOrRedirect(e, { log: false });
        try {
          localStorage.removeItem(NONCE_STORAGE_KEY);
          sessionStorage.removeItem(SESSION_NONCE_KEY);
        } catch {
          /* ignore */
        }
        await oauthBridgeEmitError(oauthNonce, msg, {
          category: isTimeout ? "timeout" : oauthErrorCategoryFromCode(parsed.code),
          code: parsed.code || undefined,
          detailMessage: parsed.message,
        });
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        gap: "1.25rem",
        background: "#0a0a0e",
        color: "#e4e4e9",
        fontFamily: "system-ui, sans-serif",
        fontSize: "15px",
        textAlign: "center",
        maxWidth: "28rem",
        margin: "0 auto",
      }}
    >
      <p style={{ margin: 0, lineHeight: 1.5 }}>{status}</p>
      {showContinueButton ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onContinueClick()}
          style={{
            padding: "0.65rem 1.25rem",
            fontSize: "15px",
            fontWeight: 600,
            color: "#0a0a0e",
            background: "#e4e4e9",
            border: "none",
            borderRadius: "8px",
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? "Opening…" : "Continue with Apple"}
        </button>
      ) : null}
    </div>
  );
}
