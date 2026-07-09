import { streamPreviewFirstLine } from "@/lib/streamPreviewFirstLine";
import { highlightTrailSharedTerms } from "@/lib/trailHighlight";
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
  const previewLine = streamPreviewFirstLine(hint.preview).trim();
  const sharedTerms = hint.shared_terms ?? [];
  const previewHtml =
    previewLine && sharedTerms.length > 0
      ? highlightTrailSharedTerms(previewLine, sharedTerms)
      : null;

  return (
    <div
      className="capture-continuation-hint"
      role="status"
      aria-label={
        previewLine
          ? `Continues a thought from ${when}: ${previewLine}`
          : `Continues a thought from ${when}`
      }
    >
      <div className="capture-continuation-hint-body">
        <p className="capture-continuation-hint-text">
          Continues a thought from {when}
        </p>
        {previewLine ? (
          previewHtml ? (
            <p
              className="capture-continuation-hint-preview"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          ) : (
            <p className="capture-continuation-hint-preview">{previewLine}</p>
          )
        ) : null}
      </div>
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
