import { useState, useEffect } from "react";
import type { Entry } from "../../types/entry";
import { Button } from "@/components/ui/button";
import { findSimilarEntries, getThoughtTrail } from "./entryApi";

type Props = {
  entry: Entry;
  onBack: () => void;
  onSelectEntry: (entry: Entry) => void;
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "…";
}

function relativeToCurrent(
  currentIso: string,
  otherIso: string,
  isCurrent: boolean
): string {
  if (isCurrent) return "Current";
  const a = new Date(currentIso).getTime();
  const b = new Date(otherIso).getTime();
  const days = Math.round((b - a) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Same day";
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} earlier`;
  return `${days} day${days === 1 ? "" : "s"} later`;
}

export function EntryDetail({ entry, onBack, onSelectEntry }: Props) {
  const [related, setRelated] = useState<Entry[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(true);
  const [trail, setTrail] = useState<Entry[]>([]);
  const [trailLoading, setTrailLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setRelatedLoading(true);
    findSimilarEntries(entry.id, 5)
      .then((list) => {
        if (!cancelled) setRelated(list);
      })
      .finally(() => {
        if (!cancelled) setRelatedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entry.id]);

  useEffect(() => {
    let cancelled = false;
    setTrailLoading(true);
    getThoughtTrail(entry.id)
      .then((list) => {
        if (!cancelled) setTrail(list);
      })
      .finally(() => {
        if (!cancelled) setTrailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entry.id]);

  return (
    <div className="entry-detail">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="entry-detail-back text-[var(--muted)] hover:text-[var(--fg-dim)] mb-7 -p-2"
        onClick={onBack}
        aria-label="Back to stream"
      >
        Back
      </Button>
      <time className="entry-detail-time" dateTime={entry.created_at}>
        {formatTimestamp(entry.created_at)}
      </time>
      <div className="entry-detail-text">{entry.text}</div>
      {trailLoading ? null : trail.length > 1 ? (
        <section className="entry-detail-trail" aria-label="Thought trail">
          <h2 className="entry-detail-trail-title">Thought trail</h2>
          <div className="entry-detail-trail-chain">
            {trail.map((e, i) => (
              <div key={e.id} className="entry-detail-trail-item-wrap">
                <button
                  type="button"
                  className="entry-detail-trail-item"
                  onClick={() => onSelectEntry(e)}
                  disabled={e.id === entry.id}
                  aria-label={e.id === entry.id ? "Current entry" : `Open: ${truncate(e.text, 60)}`}
                >
                  <span className="entry-detail-trail-meta">
                    {relativeToCurrent(entry.created_at, e.created_at, e.id === entry.id)}
                  </span>
                  <span className="entry-detail-trail-text">
                    {truncate(e.text, 80)}
                  </span>
                  <time
                    className="entry-detail-trail-time"
                    dateTime={e.created_at}
                  >
                    {formatTimestamp(e.created_at)}
                  </time>
                </button>
                {i < trail.length - 1 && (
                  <span className="entry-detail-trail-arrow" aria-hidden="true">
                    ↓
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <section className="entry-detail-related" aria-label="Related entries">
        <h2 className="entry-detail-related-title">Related entries</h2>
        {relatedLoading ? (
          <p className="entry-detail-related-loading">Loading…</p>
        ) : related.length === 0 ? (
          <p className="entry-detail-related-empty">None yet.</p>
        ) : (
          <ul className="entry-detail-related-list">
            {related.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className="entry-detail-related-item"
                  onClick={() => onSelectEntry(e)}
                >
                  <span className="entry-detail-related-text">
                    {truncate(e.text, 120)}
                  </span>
                  <time
                    className="entry-detail-related-time"
                    dateTime={e.created_at}
                  >
                    {formatTimestamp(e.created_at)}
                  </time>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
