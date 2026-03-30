import { useCallback, useEffect, useState, type MouseEvent } from "react";
import QRCode from "react-qr-code";
import { ChinottoLogo } from "@/components/ChinottoLogo";
import { isFirebaseSyncConfigured } from "@/lib/firebaseConfig";
import { useAppleSyncOAuth } from "@/lib/useAppleSyncOAuth";

type Props = {
  onClose: () => void;
};

/**
 * Universal link for mobile “Enable sync” entry (contract: chinotto-mobile docs). No query params.
 * Copy lives here and in docs/sync.md — change both if the URL changes.
 */
export const CHINOTTO_SYNC_MOBILE_UNIVERSAL_LINK = "https://getchinotto.app/sync";

type PropsInternal = Props & {
  firebaseConfigured: boolean;
};

function SyncModalInner({ onClose, firebaseConfigured }: PropsInternal) {
  const { stable } = useAppleSyncOAuth({ active: firebaseConfigured });
  const [linkCopied, setLinkCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const requestClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
      }
    },
    [requestClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleCopyLink = useCallback(() => {
    setCopyFailed(false);
    void navigator.clipboard.writeText(CHINOTTO_SYNC_MOBILE_UNIVERSAL_LINK).then(
      () => {
        setLinkCopied(true);
        window.setTimeout(() => setLinkCopied(false), 2000);
      },
      () => {
        setCopyFailed(true);
      }
    );
  }, []);

  const handleOverlayClick = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest?.(".chinotto-card")) {
      requestClose();
    }
  };

  return (
    <div
      className="chinotto-card-overlay"
      role="dialog"
      aria-labelledby="sync-modal-title"
      aria-describedby="sync-modal-footer-help"
      aria-modal="true"
      onClick={handleOverlayClick}
    >
      <div className="chinotto-card-scroll">
        <article
          className="chinotto-card sync-modal-card"
          onClick={(e) => e.stopPropagation()}
          role="document"
          aria-label="Enable sync"
        >
          <header className="chinotto-card-head">
            <ChinottoLogo size={24} className="chinotto-card-head-logo text-[var(--landing-foreground)]" />
            <div>
              <h1 id="sync-modal-title" className="chinotto-card-head-title">
                Enable sync
              </h1>
            </div>
          </header>

          <div className="sync-modal-bridge-shell">
            <div className="chinotto-card-body sync-modal-bridge-body">
              <div className="chinotto-card-col sync-modal-col--copy">
                <h2 className="sync-modal-bridge-title">
                  Keep your thoughts with you — across devices.
                </h2>
                <p className="sync-modal-bridge-lead">
                  To enable sync, continue on your phone.
                </p>
                <p className="sync-modal-bridge-hint">
                  After you enable sync, use the same Apple ID on this Mac.
                </p>
              </div>
              <div className="chinotto-card-col sync-modal-col--qr">
                <div className="sync-modal-qr-wrap">
                  <div className="sync-modal-qr-frame" aria-hidden="true">
                    <QRCode
                      value={CHINOTTO_SYNC_MOBILE_UNIVERSAL_LINK}
                      size={200}
                      style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    />
                  </div>
                  <p className="sync-modal-qr-caption">Scan with your iPhone</p>
                  <div className="sync-modal-phone-slot">
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
                  {firebaseConfigured && stable ? (
                    <p className="sync-modal-sync-on">
                      <span className="sync-modal-sync-dot" aria-hidden="true">
                        ●
                      </span>
                      Sync is on
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <footer className="chinotto-card-footer sync-modal-footer">
            <p id="sync-modal-footer-help" className="sync-modal-footer-note">
              Scan or copy opens Chinotto on your iPhone so you can enable sync there. The link carries
              no sign-in and no personal information.
            </p>
          </footer>
        </article>
      </div>
    </div>
  );
}

/**
 * Mobile sync entry: QR to universal link; shows sync-on when Firebase is configured and signed in.
 */
export function SyncModal({ onClose }: Props) {
  const firebaseConfigured = isFirebaseSyncConfigured();
  return <SyncModalInner onClose={onClose} firebaseConfigured={firebaseConfigured} />;
}
