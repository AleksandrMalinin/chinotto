import { useMemo, memo, useState } from "react";
import { motion } from "framer-motion";
import { Pin } from "lucide-react";
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

export type EntryStreamProps = {
  entries: Entry[];
  showHighlights?: boolean;
  justAddedEntryId?: string | null;
  onEntryClick?: (entry: Entry) => void;
  /** Custom section title (e.g. "Pinned") instead of date-based */
  sectionTitle?: string;
  /** If true, entries show pin icon (filled) and click unpins */
  isPinnedSection?: boolean;
  /** Toggle pin: in stream = pin, in pinned section = unpin */
  onPinToggle?: (entry: Entry) => void;
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
  isPinned,
  onPinToggle,
}: {
  entry: Entry;
  showHighlights: boolean;
  onEntryClick?: (entry: Entry) => void;
  isPinned?: boolean;
  onPinToggle?: (entry: Entry) => void;
}) {
  const [hover, setHover] = useState(false);
  const showPin = onPinToggle && (isPinned || hover);

  const useHighlight =
    showHighlights && entry.highlighted != null && entry.highlighted.length > 0;
  const content = useHighlight ? toHighlightHtml(entry.highlighted!) : entry.text;

  const row = (
    <>
      <div className="entry-row-main">
        <p id={`entry-${entry.id}`} className="entry-row-text">
          {useHighlight ? (
            <span dangerouslySetInnerHTML={{ __html: content }} />
          ) : (
            content
          )}
        </p>
        {showPin && (
          <button
            type="button"
            className={`entry-row-pin ${isPinned ? "entry-row-pin-pinned" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onPinToggle?.(entry);
            }}
            aria-label={isPinned ? "Unpin" : "Pin"}
            title={isPinned ? "Unpin" : "Pin"}
          >
            <Pin
              size={14}
              strokeWidth={isPinned ? 2.5 : 2}
              className={isPinned ? "entry-row-pin-icon-filled" : ""}
            />
          </button>
        )}
      </div>
      <time className="entry-row-time" dateTime={entry.created_at}>
        {formatTime(entry.created_at)}
      </time>
    </>
  );

  const articleClass = [
    "entry-row",
    onEntryClick && "entry-row-clickable",
    isPinned && "entry-row-pinned",
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
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
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
  isPinned,
  onPinToggle,
}: {
  section: SectionKey | string;
  entries: Entry[];
  showHighlights: boolean;
  justAddedEntryId: string | null | undefined;
  onEntryClick?: (entry: Entry) => void;
  isPinned?: boolean;
  onPinToggle?: (entry: Entry) => void;
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
                isPinned={isPinned}
                onPinToggle={onPinToggle}
              />
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}

export const EntryStream = memo<EntryStreamProps>(function EntryStream({
  entries,
  showHighlights = false,
  justAddedEntryId = null,
  onEntryClick,
  sectionTitle,
  isPinnedSection = false,
  onPinToggle,
}) {
  const sections = useMemo(() => {
    if (sectionTitle) {
      return [{ section: sectionTitle, entries }];
    }
    return groupEntriesBySection(entries);
  }, [entries, sectionTitle]);

  if (entries.length === 0 && !sectionTitle) {
    return (
      <p className="stream-empty" aria-live="polite">
        No entries yet. Type above and press Enter to add one.
      </p>
    );
  }

  if (entries.length === 0 && sectionTitle) {
    return null;
  }

  return (
    <div className="entry-stream" role="feed" aria-label={sectionTitle ?? "Entries"}>
      {sections.map(({ section, entries: sectionEntries }) => (
        <StreamSection
          key={section}
          section={section}
          entries={sectionEntries}
          showHighlights={showHighlights}
          justAddedEntryId={justAddedEntryId}
          onEntryClick={onEntryClick}
          isPinned={isPinnedSection}
          onPinToggle={onPinToggle}
        />
      ))}
    </div>
  );
});
