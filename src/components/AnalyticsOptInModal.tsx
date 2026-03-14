import { useState, useEffect, useCallback } from "react";
import { setOptIn, setAnalyticsPromptShown } from "@/lib/analytics";
import { Button } from "@/components/ui/button";

type Props = {
  onClose: () => void;
};

const EXPLAINER =
  "We send only event names and simple numbers: for example “entry created” with the length of the text, or “search used” with how many results came back. We never send the text of your thoughts, your search query, or any identifier. Data goes to our analytics provider (Umami) and is used only to understand how the app is used. Analytics are optional and can be turned off in settings at any time.";

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
          Chinotto can send anonymous usage data—e.g. that you created an entry or used search—so we can improve the app. No thought text or search queries are ever sent. You can change this anytime in settings.
        </p>
        <div className="analytics-optin-actions">
          <Button onClick={handleAllow} className="analytics-optin-btn-primary">
            Allow anonymous analytics
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
