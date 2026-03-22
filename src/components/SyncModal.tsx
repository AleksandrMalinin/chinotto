import { useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { isFirebaseSyncConfigured } from "@/lib/firebaseConfig";
import { useAppleSyncOAuth } from "@/lib/useAppleSyncOAuth";

type Props = {
  onClose: () => void;
};

/**
 * Device sync with mobile (Firebase + Apple). OAuth still completes in a separate webview or browser tab;
 * this modal is only the entry point and status, with minimal copy.
 */
export function SyncModal({ onClose }: Props) {
  const { stable, busy, signingOut, error, setError, onContinueApple, onSignOut } = useAppleSyncOAuth({
    active: true,
  });

  const requestClose = useCallback(() => {
    if (busy) {
      return;
    }
    onClose();
  }, [busy, onClose]);

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

  if (!isFirebaseSyncConfigured()) {
    return null;
  }

  return (
    <div
      className="analytics-optin-overlay"
      role="dialog"
      aria-labelledby="sync-modal-title"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div className="analytics-optin-card" onClick={(e) => e.stopPropagation()}>
        <h2 id="sync-modal-title" className="analytics-optin-title">
          Phone sync
        </h2>
        <p className="analytics-optin-body">
          Same Apple ID as on your phone. New entries from the mobile app show up here.
          {import.meta.env.DEV ? (
            <>
              {" "}
              <span className="sync-modal-dev-hint">
                A browser tab opens; tap Continue with Apple there, then return here.
              </span>
            </>
          ) : null}
        </p>
        {busy && signingOut ? (
          <p className="sync-modal-busy analytics-optin-body" aria-live="polite">
            Signing out…
          </p>
        ) : null}
        {busy && !signingOut ? (
          <p className="sync-modal-busy analytics-optin-body" aria-live="polite">
            Finish sign-in in the other window, then come back.
          </p>
        ) : null}
        {stable ? (
          <>
            <p className="analytics-optin-body" style={{ marginBottom: "1rem" }}>
              Sync is on.
            </p>
            <div className="analytics-optin-actions">
              <Button
                type="button"
                variant="ghost"
                className="analytics-optin-btn-secondary"
                disabled={busy}
                onClick={() => void onSignOut()}
              >
                Disconnect Apple
              </Button>
            </div>
          </>
        ) : (
          <div className="analytics-optin-actions">
            <Button
              type="button"
              className="analytics-optin-btn-primary"
              disabled={busy}
              onClick={() => void onContinueApple()}
            >
              Continue with Apple
            </Button>
          </div>
        )}
        {error ? (
          <p className="sync-modal-error analytics-optin-body" role="alert">
            {error}
          </p>
        ) : null}
        <div className="sync-modal-footer-links">
          {error ? (
            <button type="button" className="analytics-optin-learn" onClick={() => setError(null)}>
              Dismiss message
            </button>
          ) : null}
          <button type="button" className="analytics-optin-learn" onClick={requestClose} disabled={busy}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
