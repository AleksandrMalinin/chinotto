/**
 * Apple / Firebase OAuth diagnostics: structured console logs for debugging;
 * short, calm copy for the UI (details stay in logs).
 */

export const OAUTH_LOG_PREFIX = "[Chinotto OAuth]";

export type OAuthDiagnosticCategory =
  | "config"
  | "popup_redirect"
  | "stale_session"
  | "user_cancelled"
  | "network"
  | "timeout"
  | "unknown";

export type ParsedAuthError = { code: string; message: string };

export function parseFirebaseAuthError(e: unknown): ParsedAuthError {
  if (e && typeof e === "object") {
    const o = e as { code?: unknown; message?: unknown };
    let code = typeof o.code === "string" ? o.code : "";
    if (code === "failed-precondition") {
      code = "auth/failed-precondition";
    }
    const message =
      typeof o.message === "string"
        ? o.message
        : e instanceof Error
          ? e.message
          : String(e);
    return { code, message };
  }
  return { code: "", message: e instanceof Error ? e.message : String(e) };
}

export function oauthErrorCategoryFromCode(code: string): OAuthDiagnosticCategory {
  if (!code) {
    return "unknown";
  }
  if (
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request" ||
    code === "auth/user-cancelled"
  ) {
    return "user_cancelled";
  }
  if (
    code === "auth/popup-blocked" ||
    code === "auth/operation-not-supported-in-this-environment"
  ) {
    return "popup_redirect";
  }
  if (
    code === "auth/network-request-failed" ||
    code === "auth/internal-error"
  ) {
    return "network";
  }
  if (
    code.startsWith("auth/invalid-") ||
    code === "auth/argument-error" ||
    code === "auth/invalid-api-key" ||
    code === "auth/operation-not-allowed"
  ) {
    return "config";
  }
  if (code === "auth/no-auth-event") {
    return "stale_session";
  }
  return "unknown";
}

export function logOAuthDiagnostic(
  category: OAuthDiagnosticCategory,
  context: string,
  detail?: {
    code?: string;
    message?: string;
    extra?: Record<string, unknown>;
  }
): void {
  const parts: string[] = [`${OAUTH_LOG_PREFIX}`, category, context];
  if (detail?.code) {
    parts.push(`code=${detail.code}`);
  }
  if (detail?.message) {
    parts.push(`message=${detail.message}`);
  }
  if (detail?.extra && Object.keys(detail.extra).length > 0) {
    try {
      parts.push(JSON.stringify(detail.extra));
    } catch {
      parts.push("[extra: not serializable]");
    }
  }
  console.warn(parts.join(" | "));
}

export function logOAuthUnknownError(context: string, e: unknown): ParsedAuthError {
  const parsed = parseFirebaseAuthError(e);
  const category = oauthErrorCategoryFromCode(parsed.code);
  logOAuthDiagnostic(category, context, {
    code: parsed.code || undefined,
    message: parsed.message,
  });
  return parsed;
}

/** Short recovery hint reused when redirect or WebKit state looks stuck. */
export const OAUTH_RECOVERY_QUIT =
  "Quit Chinotto completely, then try Continue with Apple again.";

export const OAUTH_RECOVERY_SAFARI_DATA =
  "If it still fails: Safari → Settings → Privacy → Manage Website Data — remove entries for your Firebase domain (*.firebaseapp.com), apple.com, and localhost (or clear related data), then retry.";

export const OAUTH_RECOVERY_CONSOLE =
  "More detail in the browser console (search for [Chinotto OAuth]).";

export function userMessageRedirectIncomplete(browserDevBridge: boolean): string {
  if (browserDevBridge) {
    return [
      "Sign-in did not finish in the browser after you returned from Apple. Safari sometimes loses login state for this step.",
      OAUTH_RECOVERY_QUIT,
      OAUTH_RECOVERY_SAFARI_DATA,
      OAUTH_RECOVERY_CONSOLE,
    ].join(" ");
  }
  return [
    "Sign-in did not finish in the sign-in window.",
    OAUTH_RECOVERY_QUIT,
    "If it keeps failing, clear website data for Firebase and Apple for this device, then try again.",
    OAUTH_RECOVERY_CONSOLE,
  ].join(" ");
}

export function userMessageRedirectTimeout(): string {
  return [
    "Sign-in timed out waiting for the browser to finish.",
    OAUTH_RECOVERY_QUIT,
    OAUTH_RECOVERY_SAFARI_DATA,
    OAUTH_RECOVERY_CONSOLE,
  ].join(" ");
}

export function userMessageAuthNotReady(): string {
  return "Sign-in could not start (Firebase Auth was not ready). Close the sign-in window, quit Chinotto fully, and try again.";
}

export function userMessageFromFirebasePopupOrRedirect(
  e: unknown,
  options?: { log?: boolean }
): string {
  const { code, message } = parseFirebaseAuthError(e);
  const category = oauthErrorCategoryFromCode(code);
  if (options?.log !== false) {
    logOAuthDiagnostic(category, "signInWithPopup or signInWithRedirect", {
      code: code || undefined,
      message,
    });
  }

  if (category === "user_cancelled") {
    return "Sign-in was cancelled. Try again when you are ready.";
  }
  if (category === "network") {
    return "Network error during sign-in. Check your connection, then try again.";
  }
  if (category === "config") {
    return "Sign-in failed due to configuration or an invalid request. Check Firebase sync settings and authorized domains; details are in the console.";
  }
  if (code === "auth/unauthorized-domain") {
    return [
      "Sign-in failed: Firebase rejected the page origin.",
      "Add the host under Authentication → Settings → Authorized domains (dev: localhost, 127.0.0.1). Hosted /chinotto-oauth: deploy to Firebase Hosting (https://<projectId>.web.app/…) — see docs/sync.md.",
      OAUTH_RECOVERY_CONSOLE,
    ].join(" ");
  }
  if (code) {
    return `Sign-in failed (${code}). ${OAUTH_RECOVERY_QUIT} ${OAUTH_RECOVERY_CONSOLE}`;
  }
  return `${message} ${OAUTH_RECOVERY_CONSOLE}`;
}

export function userMessageFromCredentialApplyError(e: unknown): string {
  const { code, message } = parseFirebaseAuthError(e);
  const category = oauthErrorCategoryFromCode(code);
  logOAuthDiagnostic(category, "signInWithCredential (main window)", {
    code: code || undefined,
    message,
  });

  if (category === "user_cancelled") {
    return "Sign-in was cancelled.";
  }
  if (category === "network") {
    return "Could not reach Firebase to complete sign-in. Check your connection and try again.";
  }
  if (
    code === "auth/invalid-credential" &&
    /audience|expected audience/i.test(message)
  ) {
    return [
      "Firebase rejected the Apple token: native macOS sign-in sends audience app.chinotto.",
      "In Firebase Console open this project → Project settings → Your apps → Add app → Apple (or iOS+) and set Bundle ID to app.chinotto. Save, wait a minute, quit Chinotto fully, try again.",
      OAUTH_RECOVERY_CONSOLE,
    ].join(" ");
  }
  if (code === "auth/argument-error" || code === "auth/invalid-credential") {
    return [
      "The sign-in session was incomplete or out of date.",
      OAUTH_RECOVERY_QUIT,
      OAUTH_RECOVERY_SAFARI_DATA,
      OAUTH_RECOVERY_CONSOLE,
    ].join(" ");
  }
  if (code === "auth/failed-precondition") {
    return [
      "Sign-in could not complete because the Firebase session was in an unexpected state.",
      OAUTH_RECOVERY_QUIT,
      OAUTH_RECOVERY_SAFARI_DATA,
      OAUTH_RECOVERY_CONSOLE,
    ].join(" ");
  }
  if (category === "config") {
    return "Could not complete sign-in (configuration or token issue). Check the console for the error code.";
  }
  if (code) {
    return `Could not complete sign-in (${code}). ${OAUTH_RECOVERY_QUIT} ${OAUTH_RECOVERY_CONSOLE}`;
  }
  return `${message} ${OAUTH_RECOVERY_CONSOLE}`;
}

export function userMessageSyncNotConfigured(): string {
  return "Sync is not configured for this build.";
}

export function userMessageMissingNonce(): string {
  return "This sign-in link is missing session data. Close the tab and start again from Chinotto.";
}

export function userMessageOAuthTimeoutMainWindow(devBrowserFlow: boolean): string {
  const parts = [
    "Sign-in timed out.",
    "Close the sign-in window or tab if it is still open, quit Chinotto fully, then try Continue with Apple again.",
  ];
  if (devBrowserFlow) {
    parts.push(OAUTH_RECOVERY_SAFARI_DATA, OAUTH_RECOVERY_CONSOLE);
  }
  return parts.join(" ");
}

/**
 * Firebase `signInWithRedirect` stores pending state in sessionStorage; WKWebView / embedded
 * browsers often clear it on the Apple round-trip (“missing initial state” on *.firebaseapp.com).
 */
export function userMessageTauriOAuthPopupOnly(): string {
  return [
    "This window can’t complete Apple sign-in via a redirect (the system clears saved login state).",
    "Tap Continue with Apple again so sign-in opens inside this window.",
    "If nothing appears, quit Chinotto completely and try once more.",
    OAUTH_RECOVERY_CONSOLE,
  ].join(" ");
}
