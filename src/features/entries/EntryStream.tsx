import { useMemo, memo } from "react";
import { motion } from "framer-motion";
import type { Entry } from "../../types/entry";

type SectionKey = "Today" | "Yesterday" | "Earlier";

const HIGHLIGHT_START = "\u0001";
const HIGHLIGHT_END = "\u0002";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toHighlightHtml(highlighted: string): string {
  const escaped = escapeHtml(highlighted);
  return escaped
    .replace(new RegExp(HIGHLIGHT_START, "g"), "<mark>")
    .replace(new RegExp(HIGHLIGHT_END, "g"), "</mark>");
}

type Props = {
  entries: Entry[];
  showHighlights?: boolean;
  justAddedEntryId?: string | null;
  onEntryClick?: (entry: Entry) => void;
};

function getSectionKey(iso: string): SectionKey {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const entryDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const oneDay = 86400000;
  const diff = today - entryDay;
  if (diff === 0) return "Today";
  if (diff === oneDay) return "Yesterday";
  return "Earlier";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SECTION_ORDER: SectionKey[] = ["Today", "Yesterday", "Earlier"];

function groupEntriesBySection(entries: Entry[]): { section: SectionKey; entries: Entry[] }[] {
  const groups = new Map<SectionKey, Entry[]>();
  for (const key of SECTION_ORDER) {
    groups.set(key, []);
  }
  for (const entry of entries) {
    const key = getSectionKey(entry.created_at);
    groups.get(key)!.push(entry);
  }
  return SECTION_ORDER.map((section) => ({
    section,
    entries: groups.get(section)!,
  })).filter((g) => g.entries.length > 0);
}

const EntryRow = memo(function EntryRow({
  entry,
  showHighlights,
  onEntryClick,
}: {
  entry: Entry;
  showHighlights: boolean;
  onEntryClick?: (entry: Entry) => void;
}) {
  const useHighlight =
    showHighlights && entry.highlighted != null && entry.highlighted.length > 0;
  const content = useHighlight ? toHighlightHtml(entry.highlighted!) : entry.text;

  const row = (
    <>
      <p id={`entry-${entry.id}`} className="entry-row-text">
        {useHighlight ? (
          <span dangerouslySetInnerHTML={{ __html: content }} />
        ) : (
          content
        )}
      </p>
      <time className="entry-row-time" dateTime={entry.created_at}>
        {formatTime(entry.created_at)}
      </time>
    </>
  );

  const articleClass = [
    "entry-row",
    onEntryClick && "entry-row-clickable",
  ]
    .filter(Boolean)
    .join(" ");

  if (onEntryClick) {
    return (
      <article
        className={articleClass}
        aria-labelledby={`entry-${entry.id}`}
        role="button"
        tabIndex={0}
        onClick={() => onEntryClick(entry)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onEntryClick(entry);
          }
        }}
      >
        {row}
      </article>
    );
  }

  return (
    <article className={articleClass} aria-labelledby={`entry-${entry.id}`}>
      {row}
    </article>
  );
});

function StreamSection({
  section,
  entries,
  showHighlights,
  justAddedEntryId,
  onEntryClick,
}: {
  section: SectionKey;
  entries: Entry[];
  showHighlights: boolean;
  justAddedEntryId: string | null | undefined;
  onEntryClick?: (entry: Entry) => void;
}) {
  return (
    <section className="stream-section" aria-label={section}>
      <h2 className="stream-section-title">{section}</h2>
      <ol className="stream-section-list">
        {entries.map((entry) => {
          const justAdded = entry.id === justAddedEntryId;
          return (
            <motion.li
              key={entry.id}
              initial={{
                opacity: 0,
                y: justAdded ? -8 : 6,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: justAdded ? 0.32 : 0.26,
                ease: "easeOut",
              }}
            >
              <EntryRow
                entry={entry}
                showHighlights={showHighlights}
                onEntryClick={onEntryClick}
              />
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}

export const EntryStream = memo(function EntryStream({
  entries,
  showHighlights = false,
  justAddedEntryId = null,
  onEntryClick,
}: Props) {
  const sections = useMemo(() => groupEntriesBySection(entries), [entries]);

  if (entries.length === 0) {
    return (
      <p className="stream-empty" aria-live="polite">
        No entries yet. Type above and press Enter to add one.
      </p>
    );
  }

  return (
    <div className="entry-stream" role="feed" aria-label="Entries">
      {sections.map(({ section, entries: sectionEntries }) => (
        <StreamSection
          key={section}
          section={section}
          entries={sectionEntries}
          showHighlights={showHighlights}
          justAddedEntryId={justAddedEntryId}
          onEntryClick={onEntryClick}
        />
      ))}
    </div>
  );
});
