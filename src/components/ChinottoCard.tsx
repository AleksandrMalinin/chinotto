import { useEffect, useCallback, useState } from "react";
import { ChinottoLogo } from "@/components/ChinottoLogo";

const SHORTCUTS = [
  { keys: "Enter", action: "Save thought" },
  { keys: "⌘ K", action: "Search" },
  { keys: "⌘ P", action: "Pin thought" },
  { keys: "⌘ N", action: "Focus input" },
  { keys: "Esc", action: "Close overlays" },
] as const;

type Props = {
  onClose: () => void;
};

export function ChinottoCard({ onClose }: Props) {
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
      <article
        className="chinotto-card w-full max-w-[20rem] rounded-xl p-6 text-center border border-[var(--landing-card-border)]"
        style={{ backgroundColor: "var(--landing-border-subtle)" }}
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="flex flex-col items-center gap-4">
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

        <div className="mt-6 text-left">
          <h2 className="text-[10px] font-medium uppercase tracking-wider text-[var(--landing-border)] mb-3">
            Shortcuts
          </h2>
          <ul className="space-y-2">
            {SHORTCUTS.map(({ keys, action }) => (
              <li
                key={keys}
                className="flex items-center gap-2.5 text-xs text-[var(--landing-muted)]"
              >
                <kbd className="chinotto-card-kbd inline-flex items-center justify-center min-w-[3.25rem] px-2 py-0.5 rounded border font-mono text-[11px] text-[var(--landing-foreground)]">
                  {keys}
                </kbd>
                <span className="text-[var(--landing-muted)]">—</span>
                <span className="text-[var(--landing-foreground-strong)]">
                  {action}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-[10px] text-[var(--landing-border)]">Version 0.1</p>
      </article>
    </div>
  );
}
