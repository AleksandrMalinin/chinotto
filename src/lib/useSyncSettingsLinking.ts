import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getOauthBridgeWebviewUrl, isFirebaseSyncConfigured } from "@/lib/firebaseConfig";
import {
  linkOAuthCredential,
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

const OAUTH_TIMEOUT_MS = 4 * 60 * 1000;

type OauthSuccessPayload = { nonce: string; credential: BridgedOAuthCredentialJson };
type OauthErrorPayload = { nonce: string; message: string };

function isTauriShell(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function providerLabel(providerId: string): string {
  if (providerId === "apple.com") {
    return "Apple";
  }
  if (providerId === "google.com") {
    return "Google";
  }
  return providerId;
}

export function useSyncSettingsLinking(active: boolean): {
  user: User | null;
  linkedProviders: string[];
  busy: boolean;
  error: string | null;
  canLinkApple: boolean;
  onLinkApple: () => Promise<void>;
} {
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflightCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!active || !isFirebaseSyncConfigured()) {
      setUser(null);
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

  const linkedProviders = useMemo(() => {
    if (!user || user.isAnonymous) {
      return [];
    }
    return user.providerData.map((p) => providerLabel(p.providerId));
  }, [user]);

  const canLinkApple = Boolean(
    user && !user.isAnonymous && !user.providerData.some((p) => p.providerId === "apple.com")
  );

  const onLinkApple = useCallback(async () => {
    setError(null);
    if (!isTauriShell()) {
      return;
    }
    if (!canLinkApple) {
      return;
    }

    inflightCleanupRef.current?.();
    inflightCleanupRef.current = null;

    const nonce = crypto.randomUUID();
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
        await linkOAuthCredential(event.payload.credential);
        track({ event: "sync_account_link_outcome", provider: "apple", outcome: "success" });
      } catch (e) {
        track({ event: "sync_account_link_outcome", provider: "apple", outcome: "error" });
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
      track({ event: "sync_account_link_outcome", provider: "apple", outcome: "error" });
      setError(event.payload.message);
      setBusy(false);
    });
    unlisteners.push(unErr);

    timeoutId = setTimeout(() => {
      cleanup();
      setBusy(false);
      track({ event: "sync_account_link_outcome", provider: "apple", outcome: "error" });
      setError(userMessageOAuthTimeoutMainWindow(true));
    }, OAUTH_TIMEOUT_MS);

    try {
      const bridgeSecret = crypto.randomUUID();
      const bridgePort = await invoke<number>("start_oauth_dev_bridge_listener", {
        args: { secret: bridgeSecret },
      });
      const oauthUrl = import.meta.env.DEV
        ? new URL(window.location.href)
        : new URL(getOauthBridgeWebviewUrl(nonce));
      if (import.meta.env.DEV) {
        oauthUrl.pathname = "/chinotto-oauth";
        oauthUrl.search = "";
        oauthUrl.hash = "";
      }
      oauthUrl.searchParams.set("nonce", nonce);
      oauthUrl.searchParams.set("oauthDevBridge", "1");
      oauthUrl.searchParams.set("oauthDevBridgePort", String(bridgePort));
      oauthUrl.searchParams.set("oauthDevBridgeSecret", bridgeSecret);
      logOAuthDiagnostic(
        "config",
        import.meta.env.DEV ? "dev_browser_link_apple" : "packaged_hosted_link_apple",
        { message: oauthUrl.origin + oauthUrl.pathname }
      );
      await openUrl(oauthUrl.toString());
    } catch (e) {
      cleanup();
      logOAuthUnknownError("onLinkApple", e);
      track({ event: "sync_account_link_outcome", provider: "apple", outcome: "error" });
      setError("Could not start Apple sign-in. Quit Chinotto fully and try again.");
      setBusy(false);
    }
  }, [canLinkApple]);

  return { user, linkedProviders, busy, error, canLinkApple, onLinkApple };
}
