import { useEffect, useState } from "react";
import type { Entry } from "../../types/entry";
import { streamPreviewFirstLine } from "@/lib/streamPreviewFirstLine";

type Props = {
  entryId: string;
  currentCreatedAt: string;
  earlier: Entry[];
  later: Entry[];
  onSelectEntry: (entry: Entry) => void;
};

/** Collapsed trail rows per temporal side (earlier / later). */
const COLLAPSED_PER_SIDE = 3;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

function relativeWhen(currentIso: string, otherIso: string): string {
  const days = Math.round(
    (new Date(otherIso).getTime() - new Date(currentIso).getTime()) / 86_400_000
  );
  if (days === 0) return "Same day";
  if (days < 0) {
    const n = Math.abs(days);
    return `${n} day${n === 1 ? "" : "s"} earlier`;
  }
  return `${days} day${days === 1 ? "" : "s"} later`;
}

export function ThoughtTrailStrip({
  entryId,
  currentCreatedAt,
  earlier,
  later,
  onSelectEntry,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [entryId]);

  const earlierVisible = expanded
    ? earlier
    : earlier.slice(0, COLLAPSED_PER_SIDE);
  const laterVisible = expanded ? later : later.slice(0, COLLAPSED_PER_SIDE);
  const hiddenCount =
    Math.max(0, earlier.length - earlierVisible.length) +
    Math.max(0, later.length - laterVisible.length);
  const exceedsCollapsed =
    earlier.length > COLLAPSED_PER_SIDE || later.length > COLLAPSED_PER_SIDE;

  const renderRow = (entry: Entry) => {
    const preview = truncate(streamPreviewFirstLine(entry.text), 140);
    const when = relativeWhen(currentCreatedAt, entry.created_at);
    return (
      <button
        key={entry.id}
        type="button"
        className="thought-trail-strip-row"
        onClick={() => onSelectEntry(entry)}
        aria-label={`${when}: ${preview}`}
      >
        <span className="thought-trail-strip-when">{when}</span>
        <span className="thought-trail-strip-preview">{preview}</span>
      </button>
    );
  };

  return (
    <section className="thought-trail-strip" aria-label="Thought trail">
      <h2 className="thought-trail-strip-title">Thought trail</h2>
      <div className="thought-trail-strip-list">
        {earlierVisible.map(renderRow)}
        {laterVisible.map(renderRow)}
      </div>
      {exceedsCollapsed ? (
        <button
          type="button"
          className="entry-detail-rail-more"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : `+${hiddenCount} more`}
        </button>
      ) : null}
    </section>
  );
}
