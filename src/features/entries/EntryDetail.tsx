import { useState, useEffect } from "react";
import type { Entry } from "../../types/entry";
import { Button } from "@/components/ui/button";
import { findSimilarEntries } from "./entryApi";

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

export function EntryDetail({ entry, onBack, onSelectEntry }: Props) {
  const [related, setRelated] = useState<Entry[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(true);

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
