import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type AnimationEvent,
  type MouseEvent,
} from "react";
import QRCode from "react-qr-code";
import { ChinottoLogo } from "@/components/ChinottoLogo";
import { isFirebaseSyncConfigured } from "@/lib/firebaseConfig";
import {
  subscribeChinottoUserSyncAccess,
  subscribeDesktopSyncGateSession,
} from "@/lib/desktopFirestoreSync";
import { track } from "@/lib/analytics";
import { useAppleSyncOAuth } from "@/lib/useAppleSyncOAuth";

type Props = {
  onClose: () => void;
};

/**
 * Universal link base for mobile “Enable sync” entry (contract: chinotto-mobile docs).
 * Desktop appends `?ds=<uuid>` so the phone can signal this modal session in Firestore.
 */
export const CHINOTTO_SYNC_MOBILE_UNIVERSAL_LINK = "https://getchinotto.app/sync";

/** Overlay exit is 0.3s — buffer for WebKit/Tauri when `animationend` does not fire (stuck invisible layer). */
const SYNC_MODAL_CLOSE_FALLBACK_MS = 450;

type PropsInternal = Props & {
  firebaseConfigured: boolean;
};

function SyncModalInner({ onClose, firebaseConfigured }: PropsInternal) {
  const [sessionId] = useState(() => crypto.randomUUID());
  const syncMobileUrl = useMemo(() => {
    const u = new URL(CHINOTTO_SYNC_MOBILE_UNIVERSAL_LINK);
    u.searchParams.set("ds", sessionId);
    return u.toString();
  }, [sessionId]);

  const [gateUnlocked, setGateUnlocked] = useState(false);
  /** Lets users enable the desktop CTA if the iPhone step is already done but the `ds` gate doc didn’t update (or they can’t scan). */
  const [bypassGate, setBypassGate] = useState(false);

  const {
    stable,
    busy,
    signingOut,
    error,
    setError,
    onContinueApple,
    onSignOut,
    user,
  } = useAppleSyncOAuth({ active: firebaseConfigured });

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileActive, setProfileActive] = useState(false);
  /** Firestore returned permission-denied for sync modal reads (rules must allow gate + users/{uid}). */
  const [firestoreRulesBlocked, setFirestoreRulesBlocked] = useState(false);

  useEffect(() => {
    if (!firebaseConfigured) {
      setGateUnlocked(false);
      setFirestoreRulesBlocked(false);
      return undefined;
    }
    return subscribeDesktopSyncGateSession(sessionId, setGateUnlocked, {
      onPermissionDenied: () => setFirestoreRulesBlocked(true),
      onReadSucceeded: () => setFirestoreRulesBlocked(false),
    });
  }, [firebaseConfigured, sessionId]);

  useEffect(() => {
    if (!firebaseConfigured || !stable || user == null || user.isAnonymous) {
      setProfileLoading(false);
      setProfileActive(false);
      setFirestoreRulesBlocked(false);
      return undefined;
    }
    setProfileLoading(true);
    const uid = user.uid;
    return subscribeChinottoUserSyncAccess(
      uid,
      (active) => {
        setProfileActive(active);
        setProfileLoading(false);
      },
      {
        onPermissionDenied: () => setFirestoreRulesBlocked(true),
        onReadSucceeded: () => setFirestoreRulesBlocked(false),
      }
    );
  }, [firebaseConfigured, stable, user?.uid, user?.isAnonymous]);

  /**
   * Left column copy + CTA (3 states, single block — no stacking):
   * 1) Not signed in on desktop (`!stable`): instruction (+ optional bypass footnote in copy); CTA after copy block.
   * 2) Signed in, sync not active yet: status + iPhone line; no Apple CTA (already signed in — use QR / Disconnect).
   * 3) Not signed in, gate open (`!stable && (gateUnlocked || bypassGate)`): same instruction as (1); CTA enabled.
   * While `profileLoading`, show (1)/(3) instruction so we don’t flash (2) before we know access.
   */
  const ctaEnabled = firebaseConfigured && !stable && (gateUnlocked || bypassGate);
  const showSyncReady = stable && profileActive && !profileLoading;
  const showBypassHint =
    firebaseConfigured && !stable && !bypassGate && !gateUnlocked;

  const { bodyLine1, bodyLine1Class, bodyLine2 } = useMemo((): {
    bodyLine1: string;
    bodyLine1Class: string;
    bodyLine2: string | null;
  } => {
    if (showSyncReady) {
      return {
        bodyLine1: "You’re set up. New thoughts sync in the background.",
        bodyLine1Class: "sync-modal-bridge-lead",
        bodyLine2: null,
      };
    }
    if (stable && profileLoading) {
      return {
        bodyLine1: "Checking sync access…",
        bodyLine1Class: "sync-modal-bridge-lead",
        bodyLine2: null,
      };
    }
    if (stable && !profileLoading && !profileActive) {
      return {
        bodyLine1: "Sync isn’t enabled yet",
        bodyLine1Class: "sync-modal-bridge-lead sync-modal-bridge-lead--status",
        bodyLine2:
          "This Mac is signed in. Open Chinotto on your iPhone once (same Apple ID) — status updates automatically.",
      };
    }
    return {
      bodyLine1: "Enable sync on your iPhone first.",
      bodyLine1Class: "sync-modal-bridge-lead",
      bodyLine2: null,
    };
  }, [stable, profileLoading, profileActive, showSyncReady]);

  const [linkCopied, setLinkCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeCommittedRef = useRef(false);

  const finishClose = useCallback(() => {
    if (closeCommittedRef.current) {
      return;
    }
    closeCommittedRef.current = true;
    onClose();
  }, [onClose]);

  const close = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
  }, [isClosing]);

  useEffect(() => {
    if (!isClosing) {
      return undefined;
    }
    const id = window.setTimeout(() => {
      finishClose();
    }, SYNC_MODAL_CLOSE_FALLBACK_MS);
    return () => clearTimeout(id);
  }, [isClosing, finishClose]);

  const handleAnimationEnd = useCallback(
    (e: AnimationEvent) => {
      if (e.animationName !== "chinotto-card-overlay-out") {
        return;
      }
      if (e.target !== e.currentTarget) {
        return;
      }
      finishClose();
    },
    [finishClose]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    },
    [close]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleCopyLink = useCallback(() => {
    setCopyFailed(false);
    track({ event: "sync_mobile_link_copy_clicked" });
    void navigator.clipboard.writeText(syncMobileUrl).then(
      () => {
        setLinkCopied(true);
        window.setTimeout(() => setLinkCopied(false), 2000);
      },
      () => {
        setCopyFailed(true);
      }
    );
  }, [syncMobileUrl]);

  const handleOverlayClick = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest?.(".chinotto-card")) {
      close();
    }
  };

  const handleContinueApple = useCallback(() => {
    if (!ctaEnabled || busy) {
      return;
    }
    setError(null);
    track({ event: "sync_apple_continue_clicked" });
    void onContinueApple();
  }, [ctaEnabled, busy, onContinueApple, setError]);

  const connectButtonDisabled = !ctaEnabled || busy;
  const connectButtonDimmed = !ctaEnabled && !busy;
  const showAppleCta = !stable;
  const copyStatusPair = stable && !profileLoading && !profileActive;

  return (
    <div
      className="chinotto-card-overlay"
      data-closing={isClosing || undefined}
      role="dialog"
      aria-labelledby="sync-modal-title"
      aria-describedby="sync-modal-body-copy sync-modal-footer-hint"
      aria-modal="true"
      onClick={handleOverlayClick}
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="chinotto-card-scroll">
        <article
          className="chinotto-card sync-modal-card"
          onClick={(e) => e.stopPropagation()}
          role="document"
          aria-label="Enable sync"
        >
          <header className="chinotto-card-head sync-modal-head">
            <div className="sync-modal-head-start">
              <ChinottoLogo size={24} className="chinotto-card-head-logo text-[var(--landing-foreground)]" />
              <div>
                <h1 id="sync-modal-title" className="chinotto-card-head-title">
                  Enable sync
                </h1>
              </div>
            </div>
            {stable ? (
              <button
                type="button"
                className="sync-modal-head-disconnect"
                aria-label="Disconnect this Mac"
                disabled={busy || signingOut}
                onClick={() => {
                  track({ event: "sync_disconnect_clicked" });
                  void onSignOut();
                }}
              >
                {signingOut ? "Disconnecting…" : "Disconnect"}
              </button>
            ) : null}
          </header>

          <div className="sync-modal-bridge-shell">
            <div className="chinotto-card-body sync-modal-bridge-body">
              <div className="chinotto-card-col sync-modal-col--copy sync-modal-col--copy-with-cta">
                <h2
                  className={[
                    "sync-modal-bridge-title",
                    copyStatusPair ? "sync-modal-bridge-title--room-below" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  id="sync-modal-body-copy"
                >
                  Keep your thoughts with you — across devices.
                </h2>
                <div
                  className={[
                    "sync-modal-copy-swap",
                    copyStatusPair ? "sync-modal-copy-swap--status-pair" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  role="status"
                >
                  <p className={bodyLine1Class}>{bodyLine1}</p>
                  {bodyLine2 ? (
                    <p className="sync-modal-bridge-lead sync-modal-bridge-lead--second">{bodyLine2}</p>
                  ) : null}
                  {firebaseConfigured && !stable ? (
                    <div className="sync-modal-copy-footnote">
                      {showBypassHint ? (
                        <button
                          type="button"
                          className="sync-modal-bypass"
                          onClick={() => {
                            track({ event: "sync_gate_bypass_clicked" });
                            setBypassGate(true);
                          }}
                        >
                          Already finished on your iPhone?
                        </button>
                      ) : (
                        <span className="sync-modal-copy-footnote-spacer" aria-hidden="true" />
                      )}
                    </div>
                  ) : null}
                </div>
                <div
                  className={[
                    "sync-modal-connect-slot",
                    "sync-modal-connect-slot--left",
                    showSyncReady ? "sync-modal-connect-slot--sync-ready" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {showAppleCta ? (
                    <button
                      type="button"
                      className={[
                        "sync-modal-connect-apple",
                        connectButtonDimmed ? "sync-modal-connect-apple--dimmed" : "",
                        busy ? "sync-modal-connect-apple--busy" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      disabled={connectButtonDisabled}
                      onClick={handleContinueApple}
                    >
                      {busy ? "Opening…" : "Continue with Apple"}
                    </button>
                  ) : (
                    <div className="sync-modal-connect-apple-slot-spacer" aria-hidden="true" />
                  )}
                  <div className="sync-modal-post-cta sync-modal-post-cta--left">
                    <p
                      className={[
                        "sync-modal-sync-on",
                        showSyncReady ? "sync-modal-sync-on--visible" : "sync-modal-sync-on--hidden",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      role={showSyncReady ? "status" : undefined}
                      aria-live={showSyncReady ? "polite" : undefined}
                      aria-hidden={!showSyncReady}
                    >
                      <span className="sync-modal-sync-dot" aria-hidden="true">
                        ●
                      </span>
                      Sync is on
                    </p>
                  </div>
                </div>
                {error ? (
                  <p className="sync-modal-bridge-warn" role="alert">
                    {error}
                  </p>
                ) : null}
                {firestoreRulesBlocked && firebaseConfigured ? (
                  <p className="sync-modal-bridge-warn" role="alert">
                    Firebase blocked reading sync status. In Firebase Console → Firestore → Rules, publish the rules from the Chinotto sync docs (Security Rules: `sync_desktop_sessions` and `users`).
                  </p>
                ) : null}
              </div>
              <div className="chinotto-card-col sync-modal-col--qr">
                <div className="sync-modal-qr-wrap sync-modal-qr-wrap--compact">
                  <div className="sync-modal-qr-frame" aria-hidden="true">
                    <QRCode
                      value={syncMobileUrl}
                      size={168}
                      style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    />
                  </div>
                  <div className="sync-modal-phone-slot sync-modal-phone-slot--compact">
                    {copyFailed ? (
                      <button
                        type="button"
                        className="sync-modal-open-phone"
                        onClick={() => {
                          setCopyFailed(false);
                          handleCopyLink();
                        }}
                      >
                        Couldn’t copy — try again
                      </button>
                    ) : linkCopied ? (
                      <p className="sync-modal-open-phone-static" role="status" aria-live="polite">
                        Link copied — paste in Safari.
                      </p>
                    ) : (
                      <button type="button" className="sync-modal-open-phone" onClick={handleCopyLink}>
                        Open on your phone
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <footer className="chinotto-card-footer sync-modal-footer">
            <p id="sync-modal-footer-hint" className="sync-modal-footer-hint">
              Local by default. Sync optional.
            </p>
          </footer>
        </article>
      </div>
    </div>
  );
}

/**
 * Mobile sync entry: QR to universal link + `ds` session; Firestore-backed gate before Continue with Apple.
 */
export function SyncModal({ onClose }: Props) {
  const firebaseConfigured = isFirebaseSyncConfigured();
  return <SyncModalInner onClose={onClose} firebaseConfigured={firebaseConfigured} />;
}
