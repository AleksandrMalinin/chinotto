import { useEffect, useCallback, useState } from "react";
import { ChinottoLogo } from "@/components/ChinottoLogo";
import {
  getIconVariant,
  SELECTABLE_ICON_VARIANT_IDS,
  setStoredIconVariantId,
} from "@/lib/iconVariants";
import { setDesktopIcon } from "@/lib/setDesktopIcon";
import { isOptIn, setOptIn } from "@/lib/analytics";

const SHORTCUTS = [
  { keys: "Enter", action: "Save thought" },
  { keys: "⌘ P", action: "Pin thought" },
  { keys: "⌘ K", action: "Search" },
  { keys: "⌘ N", action: "Focus input" },
  { keys: "⌘ ⌫", action: "Delete thought" },
  { keys: "Esc", action: "Close overlays" },
] as const;

const ICON_PREVIEW_SIZE = 36;

type Props = {
  onClose: () => void;
  iconVariantId: string;
  onIconVariantChange: (id: string) => void;
};

const selectableVariants = SELECTABLE_ICON_VARIANT_IDS.map((id) => getIconVariant(id));

const PRIVACY_EXPLAINER =
  "We send only event names and simple numbers: for example “entry created” with the length of the text, or “search used” with how many results came back. We never send the text of your thoughts, your search query, or any identifier. Data goes to our analytics provider (Umami) and is used only to understand how the app is used. Analytics are optional and can be turned off in this panel at any time.";

export function ChinottoCard({ onClose, iconVariantId, onIconVariantChange }: Props) {
  const handleVariantClick = (id: string) => {
    setStoredIconVariantId(id);
    onIconVariantChange(id);
    setDesktopIcon(id).catch(() => {});
  };
  const [isClosing, setIsClosing] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(isOptIn);
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);

  const handleAnalyticsToggle = () => {
    const next = !analyticsEnabled;
    setOptIn(next);
    setAnalyticsEnabled(next);
  };

  const close = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
  }, [isClosing]);

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

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest?.(".chinotto-card")) close();
  };

  const handleAnimationEnd = (e: React.AnimationEvent) => {
    if (e.animationName === "chinotto-card-overlay-out") onClose();
  };

  return (
    <div
      className="chinotto-card-overlay"
      data-closing={isClosing || undefined}
      role="dialog"
      aria-label="Chinotto"
      aria-modal="true"
      onClick={handleOverlayClick}
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="chinotto-card-scroll">
        <article
          className="chinotto-card"
          onClick={(e) => e.stopPropagation()}
          role="document"
          aria-label="Preferences"
        >
          <header className="chinotto-card-head">
            <ChinottoLogo size={24} className="chinotto-card-head-logo text-[var(--landing-foreground)]" />
            <div>
              <h1 className="chinotto-card-head-title">Appearance</h1>
              <p className="chinotto-card-head-desc">Dock and taskbar icon style.</p>
            </div>
          </header>

          <section className="chinotto-card-section" aria-labelledby="chinotto-card-app-icon-title">
            <h2 id="chinotto-card-app-icon-title" className="chinotto-card-section-title">App icon</h2>
            <p className="chinotto-card-section-desc">
              Choose the icon shown in the dock (macOS) or taskbar (Windows/Linux).
            </p>
            <div className="chinotto-card-icon-grid" role="group" aria-label="Icon style">
              {selectableVariants.map((v) => {
                const selected = v.id === iconVariantId;
                return (
                  <div key={v.id} className="chinotto-card-icon-option">
                    <button
                      type="button"
                      onClick={() => handleVariantClick(v.id)}
                      className={`chinotto-card-icon-tile ${selected ? "chinotto-card-icon-tile-selected" : ""}`}
                      style={{
                        background: v.background,
                        border: v.border ?? "1px solid transparent",
                        boxShadow: v.boxShadow,
                      }}
                      title={v.name}
                      aria-label={`${v.name} icon`}
                      aria-pressed={selected}
                    >
                      <span style={{ color: v.foreground }}>
                        <ChinottoLogo size={ICON_PREVIEW_SIZE} />
                      </span>
                    </button>
                    <span className="chinotto-card-icon-caption">{v.name}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="chinotto-card-section" aria-labelledby="chinotto-card-privacy-title">
            <h2 id="chinotto-card-privacy-title" className="chinotto-card-section-title">Privacy</h2>
            <p className="chinotto-card-section-desc">
              Help improve Chinotto with anonymous usage data. Your thoughts stay private.
            </p>
            <div className="chinotto-card-privacy-row">
              <span className="chinotto-card-privacy-label">Share anonymous usage data</span>
              <button
                type="button"
                role="switch"
                aria-checked={analyticsEnabled}
                aria-label="Share anonymous usage data"
                className="chinotto-card-toggle"
                data-on={analyticsEnabled || undefined}
                onClick={handleAnalyticsToggle}
              />
            </div>
            <button
              type="button"
              className="chinotto-card-privacy-link"
              onClick={() => setShowPrivacyDetails((d) => !d)}
            >
              {showPrivacyDetails ? "Hide details" : "What is collected?"}
            </button>
            {showPrivacyDetails && (
              <p className="chinotto-card-privacy-explainer">{PRIVACY_EXPLAINER}</p>
            )}
          </section>

          <section className="chinotto-card-section" aria-labelledby="chinotto-card-shortcuts-title">
            <h2 id="chinotto-card-shortcuts-title" className="chinotto-card-section-title">Shortcuts</h2>
            <ul className="chinotto-card-shortcuts-list">
              {SHORTCUTS.map(({ keys, action }) => (
                <li key={keys} className="chinotto-card-shortcut">
                  <kbd className="chinotto-card-kbd">{keys}</kbd>
                  <span className="chinotto-card-shortcut-action">{action}</span>
                </li>
              ))}
            </ul>
          </section>

          <p className="chinotto-card-version">v0.1 beta</p>
        </article>
      </div>
    </div>
  );
}
