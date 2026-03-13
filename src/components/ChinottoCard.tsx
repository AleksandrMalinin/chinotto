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
  { keys: "⌘ K", action: "Search" },
  { keys: "⌘ P", action: "Pin thought" },
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
    if (e.target === e.currentTarget) close();
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
        >
        <div className="chinotto-card-head">
          <ChinottoLogo size={44} className="text-[var(--landing-foreground)]" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--landing-foreground)]">
              Chinotto
            </h1>
            <p className="mt-1.5 text-sm font-normal text-[var(--landing-muted)] neon-text">
              Capture first. Understand later.
            </p>
          </div>
        </div>

        <div className="chinotto-card-section">
          <h2 className="chinotto-card-section-title">App icon</h2>
          <p className="chinotto-card-section-desc">
            Click a style to set the dock icon (macOS) or taskbar icon (Windows/Linux).
          </p>
          <div className="chinotto-card-icon-grid">
            {selectableVariants.map((v) => {
              const selected = v.id === iconVariantId;
              return (
                <div key={v.id} className="chinotto-card-icon-option">
                  <button
                    type="button"
                    onClick={() => handleVariantClick(v.id)}
                    className={`rounded-lg flex items-center justify-center p-2 transition-[box-shadow,outline] focus:outline-none focus-visible:outline focus-visible:outline-offset-1 focus-visible:outline-[var(--landing-border)] ${selected ? "ring-2 ring-[var(--landing-accent)] ring-offset-2 ring-offset-[var(--landing-border-subtle)]" : ""}`}
                    style={{
                      background: v.background,
                      border: v.border ?? "1px solid transparent",
                      boxShadow: v.boxShadow,
                    }}
                    title={v.name}
                    aria-label={`Use ${v.name} icon`}
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
        </div>

        <div className="chinotto-card-section">
          <h2 className="chinotto-card-section-title">Shortcuts</h2>
          <ul className="chinotto-card-shortcuts-list">
            {SHORTCUTS.map(({ keys, action }) => (
              <li key={keys} className="chinotto-card-shortcut">
                <kbd className="chinotto-card-kbd">{keys}</kbd>
                <span className="chinotto-card-shortcut-action">{action}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="chinotto-card-version">Version 0.1</p>
      </article>
      </div>
    </div>
  );
}
