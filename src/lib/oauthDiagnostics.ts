/**
 * Apple / Firebase OAuth: structured `console.warn` for debugging; short UI copy only.
 * Details and Firebase codes stay in logs (`logOAuthDiagnostic` / `logOAuthUnknownError`).
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

/** Long Safari hint — only appended in dev (browser OAuth). */
export const OAUTH_RECOVERY_SAFARI_DATA =
  "If it still fails: Safari → Settings → Privacy → Manage Website Data — remove entries for your Firebase domain (*.firebaseapp.com), apple.com, and localhost (or clear related data), then retry.";

function safariHintIfDev(): string {
  return import.meta.env.DEV ? ` ${OAUTH_RECOVERY_SAFARI_DATA}` : "";
}

export function userMessageRedirectIncomplete(browserDevBridge: boolean): string {
  if (browserDevBridge) {
    return [
      "Sign-in did not finish in the browser after you returned from Apple.",
      OAUTH_RECOVERY_QUIT,
      safariHintIfDev(),
    ]
      .join(" ")
      .trim();
  }
  return [
    "Sign-in did not finish in the sign-in window.",
    OAUTH_RECOVERY_QUIT,
    import.meta.env.DEV
      ? "If it keeps failing, clear website data for Firebase and Apple on this device, then try again."
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function userMessageRedirectTimeout(): string {
  return ["Sign-in timed out waiting for the browser to finish.", OAUTH_RECOVERY_QUIT, safariHintIfDev()]
    .join(" ")
    .trim();
}

export function userMessageAuthNotReady(): string {
  return "Sign-in could not start. Close the sign-in window, quit Chinotto fully, and try again.";
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
    return import.meta.env.DEV
      ? "Sign-in failed (Firebase configuration or authorized domains). See console for the error code."
      : "Sign-in could not be completed. Check your connection and try again.";
  }
  if (code === "auth/unauthorized-domain") {
    return import.meta.env.DEV
      ? [
          "Firebase rejected this page's domain.",
          "Add localhost and 127.0.0.1 under Authentication → Settings → Authorized domains.",
          "Hosted /chinotto-oauth: deploy to Firebase Hosting (https://<projectId>.web.app/…).",
        ].join(" ")
      : "Sign-in could not be completed for this app build. Try again later, or contact support if it persists.";
  }
  if (code) {
    return import.meta.env.DEV
      ? `Sign-in failed (${code}). ${OAUTH_RECOVERY_QUIT}`
      : `Sign-in failed. ${OAUTH_RECOVERY_QUIT}`;
  }
  return import.meta.env.DEV ? `${message} ${OAUTH_RECOVERY_QUIT}` : `Sign-in failed. ${OAUTH_RECOVERY_QUIT}`;
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
    return import.meta.env.DEV
      ? "Firebase rejected the Apple token (audience must be app.chinotto). In Firebase → Project settings → Your apps, add an Apple app with that bundle ID, wait a minute, then try again."
      : "Sign-in could not be verified for this Mac app. Try again in a moment; if it keeps failing, the project needs the Mac bundle id (app.chinotto) registered in Firebase.";
  }
  if (code === "auth/argument-error" || code === "auth/invalid-credential") {
    return [
      "Sign-in was interrupted or expired.",
      OAUTH_RECOVERY_QUIT,
      safariHintIfDev(),
    ]
      .join(" ")
      .trim();
  }
  if (code === "auth/failed-precondition") {
    return [
      "Sign-in could not complete because the session was in an unexpected state.",
      OAUTH_RECOVERY_QUIT,
      safariHintIfDev(),
    ]
      .join(" ")
      .trim();
  }
  if (category === "config") {
    return import.meta.env.DEV
      ? "Could not complete sign-in (configuration or token). See console for the error code."
      : "Could not complete sign-in. Try again in a moment.";
  }
  if (code) {
    return import.meta.env.DEV
      ? `Could not complete sign-in (${code}). ${OAUTH_RECOVERY_QUIT}`
      : `Could not complete sign-in. ${OAUTH_RECOVERY_QUIT}`;
  }
  return import.meta.env.DEV ? `${message} ${OAUTH_RECOVERY_QUIT}` : `Could not complete sign-in. ${OAUTH_RECOVERY_QUIT}`;
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
    parts.push(safariHintIfDev().trim());
  }
  return parts.filter(Boolean).join(" ");
}

/**
 * Firebase `signInWithRedirect` stores pending state in sessionStorage; WKWebView / embedded
 * browsers often clear it on the Apple round-trip (“missing initial state” on *.firebaseapp.com).
 */
export function userMessageTauriOAuthPopupOnly(): string {
  return [
    "This window can’t complete Apple sign-in with a redirect.",
    "Tap Continue with Apple again so sign-in runs inside this window.",
    "If nothing appears, quit Chinotto completely and try once more.",
  ].join(" ");
}
