import { useEffect, useCallback, useState } from "react";
import { ChinottoLogo } from "@/components/ChinottoLogo";

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
      <div
        className="chinotto-card"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="chinotto-card-logo">
          <ChinottoLogo size={44} />
        </div>
        <h1 className="chinotto-card-title">Chinotto</h1>
        <p className="chinotto-card-tagline">Capture first. Understand later.</p>

        <section className="chinotto-card-section" aria-label="Shortcuts">
          <h2 className="chinotto-card-section-title">Shortcuts</h2>
          <ul className="chinotto-card-shortcuts">
            <li><kbd>Enter</kbd> — Save thought</li>
            <li><kbd>⌘</kbd> <kbd>K</kbd> — Search</li>
            <li><kbd>⌘</kbd> <kbd>P</kbd> — Pin thought</li>
            <li><kbd>⌘</kbd> <kbd>N</kbd> — Focus input</li>
            <li><kbd>Esc</kbd> — Close overlays</li>
          </ul>
        </section>

        <p className="chinotto-card-version">Version 0.1</p>
      </div>
    </div>
  );
}
