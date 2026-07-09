import type { CaptureContinuationHint } from "./entryApi";

type Props = {
  hint: CaptureContinuationHint;
  onOpen: () => void;
  onDismiss: () => void;
};

export function CaptureContinuationHint({
  hint,
  onOpen,
  onDismiss,
}: Props) {
  const when =
    hint.days_earlier === 0
      ? "today"
      : `${hint.days_earlier} day${hint.days_earlier === 1 ? "" : "s"} ago`;

  return (
    <div className="capture-continuation-hint" role="status">
      <p className="capture-continuation-hint-text">
        Continues a thought from {when}
      </p>
      <div className="capture-continuation-hint-actions">
        <button type="button" className="capture-continuation-hint-open" onClick={onOpen}>
          Open
        </button>
        <button
          type="button"
          className="capture-continuation-hint-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
