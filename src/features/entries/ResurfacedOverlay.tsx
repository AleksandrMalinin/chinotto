import { useEffect, useCallback } from "react";
import type { Entry } from "../../types/entry";

type Props = {
  entry: Entry;
  /** Memory-style reason from backend, e.g. "From yesterday" */
  reason?: string;
  onOpen: (entry: Entry) => void;
  onDismiss: () => void;
};

const MAX_PREVIEW = 280;

function fromAgoLabel(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const days = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  if (days >= 365) {
    const y = Math.floor(days / 365);
    return `${y} year${y === 1 ? "" : "s"}`;
  }
  if (days >= 30) {
    const m = Math.floor(days / 30);
    return `${m} month${m === 1 ? "" : "s"}`;
  }
  if (days >= 7) {
    const w = Math.floor(days / 7);
    return `${w} week${w === 1 ? "" : "s"}`;
  }
  if (days >= 1) {
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  return "earlier today";
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

export function ResurfacedOverlay({
  entry,
  reason: reasonProp,
  onOpen,
  onDismiss,
}: Props) {
  const label = reasonProp ?? (fromAgoLabel(entry.created_at) === "earlier today"
    ? "From earlier today"
    : `From ${fromAgoLabel(entry.created_at)} ago`);
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        onDismiss();
      }
    },
    [onDismiss]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="resurfaced-overlay"
      role="dialog"
      aria-label="Resurfaced thought"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" || e.key === "Enter") {
          e.preventDefault();
          onDismiss();
        }
      }}
    >
      <button
        type="button"
        className="resurfaced-overlay-card"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(entry);
        }}
        aria-label="Open this thought"
      >
        <p className="resurfaced-overlay-label">{label}</p>
        <p className="resurfaced-overlay-text">{truncate(entry.text, MAX_PREVIEW)}</p>
      </button>
    </div>
  );
}
