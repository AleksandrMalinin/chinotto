import { useEffect, useMemo, useRef, useState } from "react";
import type { Entry } from "../../types/entry";
import { streamPreviewFirstLine } from "@/lib/streamPreviewFirstLine";
import { highlightTrailSharedTerms } from "@/lib/trailHighlight";

type Props = {
  entryId: string;
  currentEntry: Entry;
  currentCreatedAt: string;
  earlier: Entry[];
  later: Entry[];
  onSelectEntry: (entry: Entry) => void;
  /** Scroll trail into view when detail opens from resurface. */
  emphasizeOnMount?: boolean;
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
  currentEntry,
  currentCreatedAt,
  earlier,
  later,
  onSelectEntry,
  emphasizeOnMount = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setExpanded(false);
    setFocusIndex(null);
  }, [entryId]);

  useEffect(() => {
    if (!emphasizeOnMount || !sectionRef.current) return;
    const t = window.setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 120);
    return () => clearTimeout(t);
  }, [emphasizeOnMount, entryId]);

  const earlierChron = useMemo(
    () =>
      [...earlier].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    [earlier]
  );
  const laterChron = useMemo(
    () =>
      [...later].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    [later]
  );

  const earlierVisible = expanded
    ? earlierChron
    : earlierChron.slice(-COLLAPSED_PER_SIDE);
  const laterVisible = expanded
    ? laterChron
    : laterChron.slice(0, COLLAPSED_PER_SIDE);
  const hiddenCount =
    Math.max(0, earlierChron.length - earlierVisible.length) +
    Math.max(0, laterChron.length - laterVisible.length);
  const exceedsCollapsed =
    earlierChron.length > COLLAPSED_PER_SIDE ||
    laterChron.length > COLLAPSED_PER_SIDE;

  const navOrder = useMemo(
    () => [...earlierChron, currentEntry, ...laterChron],
    [earlierChron, currentEntry, laterChron]
  );
  const currentNavIndex = earlierChron.length;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!sectionRef.current) return;
      const inDetail = document.querySelector(".entry-detail--focus");
      if (!inDetail?.contains(sectionRef.current)) return;
      if (
        (e.target as HTMLElement)?.closest?.("textarea, input, [contenteditable]")
      ) {
        return;
      }
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown" && e.key !== "k" && e.key !== "j") {
        return;
      }
      const prev =
        e.key === "ArrowUp" || (e.key === "k" && !e.metaKey && !e.ctrlKey);
      const next =
        e.key === "ArrowDown" || (e.key === "j" && !e.metaKey && !e.ctrlKey);
      if (!prev && !next) return;
      e.preventDefault();
      setFocusIndex((idx) => {
        const base = idx ?? currentNavIndex;
        const nextIdx = prev
          ? Math.max(0, base - 1)
          : Math.min(navOrder.length - 1, base + 1);
        const target = navOrder[nextIdx];
        if (target && target.id !== entryId) {
          onSelectEntry(target);
        }
        return nextIdx;
      });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentNavIndex, entryId, navOrder, onSelectEntry]);

  useEffect(() => {
    if (focusIndex == null) return;
    rowRefs.current[focusIndex]?.focus();
  }, [focusIndex, entryId]);

  const currentPreview = truncate(
    streamPreviewFirstLine(currentEntry.text),
    140
  );

  const renderRow = (entry: Entry, navIndex: number) => {
    const preview = truncate(streamPreviewFirstLine(entry.text), 140);
    const when = relativeWhen(currentCreatedAt, entry.created_at);
    const shared = entry.trail_shared ?? [];
    const previewHtml = highlightTrailSharedTerms(preview, shared);
    return (
      <button
        key={entry.id}
        ref={(el) => {
          rowRefs.current[navIndex] = el;
        }}
        type="button"
        className="thought-trail-strip-row"
        onClick={() => onSelectEntry(entry)}
        aria-label={`${when}: ${preview}`}
      >
        <span className="thought-trail-strip-axis-dot" aria-hidden="true" />
        <span className="thought-trail-strip-when">{when}</span>
        <span
          className="thought-trail-strip-preview"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </button>
    );
  };

  let navIdx = 0;

  return (
    <section
      ref={sectionRef}
      className={[
        "thought-trail-strip",
        emphasizeOnMount ? "thought-trail-strip--emphasized" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Thought trail"
    >
      <h2 className="thought-trail-strip-title">Thought trail</h2>
      <p className="thought-trail-strip-hint">
        ↑↓ or j/k to walk the thread
      </p>
      <div className="thought-trail-strip-axis">
        {earlierVisible.map((entry) => {
          const idx = navIdx++;
          return renderRow(entry, idx);
        })}
        <div
          className="thought-trail-strip-current"
          aria-current="true"
          ref={(el) => {
            rowRefs.current[currentNavIndex] = null;
            void el;
          }}
        >
          <span className="thought-trail-strip-axis-dot thought-trail-strip-axis-dot--current" aria-hidden="true" />
          <span className="thought-trail-strip-when">Current</span>
          <span className="thought-trail-strip-preview thought-trail-strip-preview--current">
            {currentPreview}
          </span>
        </div>
        {laterVisible.map((entry) => {
          const idx = navIdx++;
          return renderRow(entry, idx);
        })}
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
