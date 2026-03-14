import { useEffect, useCallback, useState } from "react";
import { ChinottoLogo } from "@/components/ChinottoLogo";
import {
  getIconVariant,
  SELECTABLE_ICON_VARIANT_IDS,
  setStoredIconVariantId,
} from "@/lib/iconVariants";
import { setDesktopIcon } from "@/lib/setDesktopIcon";

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

export function ChinottoCard({ onClose, iconVariantId, onIconVariantChange }: Props) {
  const handleVariantClick = (id: string) => {
    setStoredIconVariantId(id);
    onIconVariantChange(id);
    setDesktopIcon(id).catch(() => {});
  };
  const [isClosing, setIsClosing] = useState(false);

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
