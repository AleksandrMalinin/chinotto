import { useMemo, memo, useState, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Pin, X } from "lucide-react";
import { StreamFlowPanel } from "@/components/StreamFlowPanel";
import type { Entry } from "../../types/entry";
import { EntryTextWithLinks } from "./EntryTextWithLinks";

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
  /** Entry ids in the ~15s ephemeral edit window (inline editable, subtle glow) */
  ephemeralEntryIds?: Set<string>;
  /** Entry id currently in late edit (double-click or Cmd+E) */
  editingEntryId?: string | null;
  /** Entry ids in brief "settling" state after ephemeral window closes */
  settlingEntryIds?: Set<string>;
  onEntryUpdate?: (entryId: string, text: string) => void;
  onStartLateEdit?: (entry: Entry) => void;
  onEndEdit?: (entryId: string) => void;
  onEntryClick?: (entry: Entry) => void;
  /** Custom section title (e.g. "Pinned") instead of date-based */
  sectionTitle?: string;
  /** If true, entries show pin icon (filled) and click unpins */
  isPinnedSection?: boolean;
  /** Toggle pin: in stream = pin, in pinned section = unpin */
  onPinToggle?: (entry: Entry) => void;
  /** Delete entry; shows × and ⌘⌫ on hover */
  onEntryDelete?: (entry: Entry) => void;
  /** Set of entry ids currently playing delete animation */
  deletingIds?: Set<string>;
  /** Called when delete exit animation finishes so parent can remove from list */
  onDeleteAnimationEnd?: (entryId: string) => void;
  /** Called when pointer enters/leaves a row (for global Cmd+Backspace to delete hovered) */
  onEntryHover?: (entry: Entry | null) => void;
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

const emptyOnboardingEase = [0.22, 1, 0.36, 1] as const;

const emptyOnboardingItem = {
  hidden: { opacity: 0, y: 18, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.52, ease: emptyOnboardingEase },
  },
};

const emptyOnboardingContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.14 },
  },
};

const emptyOnboardingInstant = {
  hidden: { opacity: 1, y: 0, filter: "blur(0px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0 },
  },
};

const emptyOnboardingContainerInstant = {
  hidden: {},
  visible: { transition: { staggerChildren: 0, delayChildren: 0 } },
};

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
  isEditable,
  isSettling,
  onEntryClick,
  onEntryUpdate,
  onStartLateEdit,
  onEndEdit,
  isPinned,
  onPinToggle,
  onEntryDelete,
  onEntryHover,
}: {
  entry: Entry;
  showHighlights: boolean;
  isEditable: boolean;
  isSettling: boolean;
  onEntryClick?: (entry: Entry) => void;
  onEntryUpdate?: (entryId: string, text: string) => void;
  onStartLateEdit?: (entry: Entry) => void;
  onEndEdit?: (entryId: string) => void;
  isPinned?: boolean;
  onPinToggle?: (entry: Entry) => void;
  onEntryDelete?: (entry: Entry) => void;
  onEntryHover?: (entry: Entry | null) => void;
}) {
  const [hover, setHover] = useState(false);
  const [editValue, setEditValue] = useState(entry.text);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showPin = onPinToggle && (isPinned || hover);

  useEffect(() => {
    if (isEditable) {
      setEditValue(entry.text);
      editInputRef.current?.focus();
    }
  }, [isEditable, entry.id]);
  useEffect(() => {
    setEditValue(entry.text);
  }, [entry.text]);

  useEffect(() => {
    const el = editInputRef.current;
    if (!el || !isEditable) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 24)}px`;
  }, [isEditable, editValue]);

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
    };
  }, []);

  const useHighlight =
    !isEditable &&
    showHighlights &&
    entry.highlighted != null &&
    entry.highlighted.length > 0;
  const content = useHighlight ? toHighlightHtml(entry.highlighted!) : entry.text;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isEditable) return;
    if ((e.metaKey || e.ctrlKey) && e.key === "Backspace") {
      e.preventDefault();
      e.stopPropagation();
      onEntryDelete?.(entry);
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "e") {
      e.preventDefault();
      onStartLateEdit?.(entry);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      if ((e.target as HTMLElement)?.closest?.("a.entry-link")) return;
      e.preventDefault();
      onEntryClick?.(entry);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = editValue.trim();
      if (text && onEntryUpdate) {
        onEntryUpdate(entry.id, text);
      }
      onEndEdit?.(entry.id);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setEditValue(entry.text);
      onEndEdit?.(entry.id);
      editInputRef.current?.blur();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isEditable) return;
    e.preventDefault();
    e.stopPropagation();
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    onStartLateEdit?.(entry);
  };

  const row = (
    <>
      <div className="entry-row-main">
        {isEditable ? (
          <textarea
            ref={editInputRef}
            id={`entry-${entry.id}`}
            className="entry-row-edit-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleEditKeyDown}
            onClick={(e) => e.stopPropagation()}
            aria-label="Edit entry"
            rows={1}
          />
        ) : useHighlight ? (
          <p id={`entry-${entry.id}`} className="entry-row-text">
            <span dangerouslySetInnerHTML={{ __html: content }} />
          </p>
        ) : (
          <div id={`entry-${entry.id}`} className="entry-row-text-wrap">
            <EntryTextWithLinks text={entry.text} variant="stream" />
          </div>
        )}
        {onEntryDelete && (
          <button
            type="button"
            className="entry-row-delete"
            onClick={(e) => {
              e.stopPropagation();
              onEntryDelete(entry);
            }}
            aria-label="Delete entry"
            title="Delete"
          >
            <X size={14} strokeWidth={2} />
          </button>
        )}
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
    isEditable && "entry-row-editable",
    isSettling && "entry-row-settling",
    onEntryClick && "entry-row-clickable",
    isPinned && "entry-row-pinned",
  ]
    .filter(Boolean)
    .join(" ");

  if (onEntryClick || onEntryDelete || onStartLateEdit) {
    return (
      <article
        className={articleClass}
        aria-labelledby={`entry-${entry.id}`}
        role="button"
        tabIndex={0}
        onClick={(e) => {
          if ((e.target as HTMLElement)?.closest?.("a.entry-link")) return;
          if (isEditable) return;
          if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
          clickTimeoutRef.current = setTimeout(() => {
            onEntryClick?.(entry);
            clickTimeoutRef.current = null;
          }, 180);
        }}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => {
          setHover(true);
          onEntryHover?.(entry);
        }}
        onMouseLeave={() => {
          setHover(false);
          onEntryHover?.(null);
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
  ephemeralEntryIds,
  editingEntryId,
  settlingEntryIds,
  onEntryUpdate,
  onStartLateEdit,
  onEndEdit,
  onEntryClick,
  isPinned,
  onPinToggle,
  onEntryDelete,
  deletingIds,
  onDeleteAnimationEnd,
  onEntryHover,
}: {
  section: SectionKey | string;
  entries: Entry[];
  showHighlights: boolean;
  justAddedEntryId: string | null | undefined;
  ephemeralEntryIds?: Set<string>;
  editingEntryId?: string | null;
  settlingEntryIds?: Set<string>;
  onEntryUpdate?: (entryId: string, text: string) => void;
  onStartLateEdit?: (entry: Entry) => void;
  onEndEdit?: (entryId: string) => void;
  onEntryClick?: (entry: Entry) => void;
  isPinned?: boolean;
  onPinToggle?: (entry: Entry) => void;
  onEntryDelete?: (entry: Entry) => void;
  deletingIds?: Set<string>;
  onDeleteAnimationEnd?: (entryId: string) => void;
  onEntryHover?: (entry: Entry | null) => void;
}) {
  const isDeleting = (id: string) => deletingIds?.has(id) ?? false;
  const ephemeral = ephemeralEntryIds ?? new Set();
  const settling = settlingEntryIds ?? new Set();

  return (
    <section className="stream-section" aria-label={section}>
      <h2 className="stream-section-title">{section}</h2>
      <ol className="stream-section-list">
        {entries.map((entry) => {
          const justAdded = entry.id === justAddedEntryId;
          const deleting = isDeleting(entry.id);
          const isEditable = ephemeral.has(entry.id) || editingEntryId === entry.id;
          const isSettling = settling.has(entry.id);
          return (
            <motion.li
              key={entry.id}
              initial={{
                opacity: 0,
                y: justAdded ? -8 : 6,
              }}
              animate={deleting ? undefined : { opacity: 1, y: 0 }}
              transition={{
                duration: justAdded ? 0.32 : 0.26,
                ease: "easeOut",
              }}
            >
              <div
                className={`entry-row-li-inner ${deleting ? "entry-row-li-inner-deleting" : ""}`}
                onTransitionEnd={(e) => {
                  if (deleting && e.propertyName === "max-height") {
                    onDeleteAnimationEnd?.(entry.id);
                  }
                }}
              >
                <EntryRow
                  entry={entry}
                  showHighlights={showHighlights}
                  isEditable={isEditable}
                  isSettling={isSettling}
                  onEntryClick={onEntryClick}
                  onEntryUpdate={onEntryUpdate}
                  onStartLateEdit={onStartLateEdit}
                  onEndEdit={onEndEdit}
                  isPinned={isPinned}
                  onPinToggle={onPinToggle}
                  onEntryDelete={onEntryDelete}
                  onEntryHover={onEntryHover}
                />
              </div>
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
  ephemeralEntryIds = new Set(),
  editingEntryId = null,
  settlingEntryIds = new Set(),
  onEntryUpdate,
  onStartLateEdit,
  onEndEdit,
  onEntryClick,
  sectionTitle,
  isPinnedSection = false,
  onPinToggle,
  onEntryDelete,
  deletingIds,
  onDeleteAnimationEnd,
  onEntryHover,
}) {
  const reduceMotion = useReducedMotion();

  const sections = useMemo(() => {
    if (sectionTitle) {
      return [{ section: sectionTitle, entries }];
    }
    return groupEntriesBySection(entries);
  }, [entries, sectionTitle]);

  /* Empty timeline serves as first-run onboarding: no separate screens or flags. */
  if (entries.length === 0 && !sectionTitle) {
    if (showHighlights) {
      return (
        <p className="stream-empty" aria-live="polite">
          No thoughts match your search.
        </p>
      );
    }
    const onboardingItem = reduceMotion ? emptyOnboardingInstant : emptyOnboardingItem;
    const onboardingContainer = reduceMotion
      ? emptyOnboardingContainerInstant
      : emptyOnboardingContainer;

    return (
      <motion.div
        className="stream-empty stream-empty-onboarding"
        aria-live="polite"
        initial="hidden"
        animate="visible"
        variants={onboardingContainer}
      >
        <motion.div variants={onboardingItem}>
          <StreamFlowPanel />
        </motion.div>

        <motion.div className="stream-empty-onboarding-copy" variants={onboardingContainer}>
          <motion.h2 className="stream-empty-title" variants={onboardingItem}>
            Just write. No structure.
          </motion.h2>
          <motion.p className="stream-empty-lead" variants={onboardingItem}>
            Start with one line.
          </motion.p>
          <motion.p className="stream-empty-meta" variants={onboardingItem}>
            Your thoughts leave a trail.
            <br />
            You’ll see them again when it matters.
          </motion.p>
          <motion.p className="stream-empty-hint" variants={onboardingItem}>
            Start typing above
            <br />
            <br />
            <kbd className="stream-empty-kbd">Enter</kbd> saves
          </motion.p>
        </motion.div>
      </motion.div>
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
          ephemeralEntryIds={ephemeralEntryIds}
          editingEntryId={editingEntryId}
          settlingEntryIds={settlingEntryIds}
          onEntryUpdate={onEntryUpdate}
          onStartLateEdit={onStartLateEdit}
          onEndEdit={onEndEdit}
          onEntryClick={onEntryClick}
          isPinned={isPinnedSection}
          onPinToggle={onPinToggle}
          onEntryDelete={onEntryDelete}
          deletingIds={deletingIds}
          onDeleteAnimationEnd={onDeleteAnimationEnd}
          onEntryHover={onEntryHover}
        />
      ))}
    </div>
  );
});
