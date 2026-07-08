import type { Entry } from "../../types/entry";
import { streamPreviewFirstLine } from "@/lib/streamPreviewFirstLine";

type Props = {
  currentCreatedAt: string;
  earlier: Entry[];
  later: Entry[];
  onSelectEntry: (entry: Entry) => void;
};

const MAX_VISIBLE_PER_SIDE = 3;

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
  currentCreatedAt,
  earlier,
  later,
  onSelectEntry,
}: Props) {
  const earlierVisible = earlier.slice(0, MAX_VISIBLE_PER_SIDE);
  const laterVisible = later.slice(0, MAX_VISIBLE_PER_SIDE);

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
    </section>
  );
}
