import { useState, useEffect, useCallback } from "react";
import { setOptIn, setAnalyticsPromptShown } from "@/lib/analytics";
import { Button } from "@/components/ui/button";

type Props = {
  onClose: () => void;
};

const EXPLAINER =
  "We send only simple event names and numbers — for example “entry created” with the text length or “search used” with the number of results. We never send the text of your thoughts, your search query, or any personal identifier. All thoughts stay on your device. Analytics are used only to understand how the app is used and can be turned off in Settings at any time.";

export function AnalyticsOptInModal({ onClose }: Props) {
  const [showLearnMore, setShowLearnMore] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setAnalyticsPromptShown();
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleAllow = () => {
    setOptIn(true);
    setAnalyticsPromptShown();
    onClose();
  };

  const handleDecline = () => {
    setOptIn(false);
    setAnalyticsPromptShown();
    onClose();
  };

  const handleDismissWithoutChoice = () => {
    setAnalyticsPromptShown();
    onClose();
  };

  return (
    <div
      className="analytics-optin-overlay"
      role="dialog"
      aria-labelledby="analytics-optin-title"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && handleDismissWithoutChoice()}
    >
      <div className="analytics-optin-card" onClick={(e) => e.stopPropagation()}>
        <h2 id="analytics-optin-title" className="analytics-optin-title">
          Analytics (optional)
        </h2>
        <p className="analytics-optin-body">
          Chinotto sends only anonymous usage events (e.g. entry created or search used) to help improve the app. Your thoughts and search text are never sent. You can disable analytics anytime in Settings.
        </p>
        <div className="analytics-optin-actions">
          <Button onClick={handleAllow} className="analytics-optin-btn-primary">
            Allow analytics
          </Button>
          <Button variant="ghost" onClick={handleDecline} className="analytics-optin-btn-secondary">
            No thanks
          </Button>
        </div>
        <button
          type="button"
          className="analytics-optin-learn"
          onClick={() => setShowLearnMore((v) => !v)}
        >
          {showLearnMore ? "Hide details" : "Learn more"}
        </button>
        {showLearnMore && <p className="analytics-optin-explainer">{EXPLAINER}</p>}
      </div>
    </div>
  );
}
