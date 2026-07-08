import { useCallback, useEffect } from "react";
import type { Entry } from "../../types/entry";
import { streamPreviewFirstLine } from "@/lib/streamPreviewFirstLine";

type Props = {
  entry: Entry;
  reason: string;
  onOpen: (entry: Entry) => void;
  onDismiss: () => void;
  /** When false, horizon is drawn by the parent depth zone. */
  showHorizon?: boolean;
};

const MAX_PREVIEW = 220;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

export function MemoryEcho({
  entry,
  reason,
  onOpen,
  onDismiss,
  showHorizon = true,
}: Props) {
  const preview = truncate(streamPreviewFirstLine(entry.text), MAX_PREVIEW);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
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
    <section className="memory-echo" aria-label="Memory from earlier">
      {showHorizon ? (
        <div className="memory-echo-horizon" aria-hidden="true">
          <span className="memory-echo-horizon-line" />
          <span className="memory-echo-horizon-glow" />
        </div>
      ) : null}
      <p className="memory-echo-label">{reason}</p>
      <button
        type="button"
        className="memory-echo-body"
        onClick={() => onOpen(entry)}
      >
        <p className="memory-echo-text">{preview}</p>
        <span className="memory-echo-cta">Continue this thought</span>
      </button>
      <button
        type="button"
        className="memory-echo-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss memory"
      >
        ×
      </button>
    </section>
  );
}
