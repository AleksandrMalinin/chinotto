import { useMemo, memo, useState, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Pin, X } from "lucide-react";
import { StreamFlowPanel } from "@/components/StreamFlowPanel";
import { ENTER_KEY_GLYPH } from "@/lib/keyboardLabels";
import type { Entry } from "../../types/entry";
import { EntryTextWithLinks } from "./EntryTextWithLinks";

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

/** Wired from App: fade out on first typing/save; soft variant after user has saved before. */
export type EmptyOnboardingConfig = {
  variant: "full" | "soft";
  exiting: boolean;
  typingAccent: boolean;
  onExitComplete: () => void;
};

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
  /** Delete thought; shows × and ⌘⌫ on hover */
  onEntryDelete?: (entry: Entry) => void;
  /** Set of entry ids currently playing delete animation */
  deletingIds?: Set<string>;
  /** Called when delete exit animation finishes so parent can remove from list */
  onDeleteAnimationEnd?: (entryId: string) => void;
  /** Called when pointer enters/leaves a row (for global Cmd+Backspace to delete hovered) */
  onEntryHover?: (entry: Entry | null) => void;
  /**
   * Empty main stream only: progressive onboarding. `null` = user dismissed (placeholder, no copy).
   * Omit to use default full onboarding (static defaults; no App-driven exit/soft variant).
   */
  emptyOnboarding?: EmptyOnboardingConfig | null;
  /**
   * When true, empty-state trail panel holds CSS motion until intro is dismissed (launch / relaunch).
   */
  deferEmptyPanelMotion?: boolean;
  /**
   * When false (intro still open), empty onboarding stays invisible and motion children stay in `hidden`.
   * When true, outer opacity fades in and stagger runs — same soft entrance as before progressive wiring.
   */
  revealEmptyOnboarding?: boolean;
};

function getSectionMeta(iso: string): { key: string; label: string } {
  const d = new Date(iso);
  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const entryDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = todayDate.getTime();
  const entryDay = entryDate.getTime();
  const oneDay = 86400000;
  const diff = today - entryDay;
  if (diff === 0) return { key: "today", label: "Today" };
  if (diff === oneDay) return { key: "yesterday", label: "Yesterday" };
  const key = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, "0")}-${String(entryDate.getDate()).padStart(2, "0")}`;
  const label = entryDate.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return { key, label };
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const emptyOnboardingEase = [0.22, 1, 0.36, 1] as const;

const emptyOnboardingItem = {
  hidden: { opacity: 0, y: 18, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.62, ease: emptyOnboardingEase },
  },
};

const emptyOnboardingContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.18 },
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

const ONBOARDING_EXIT_S = 0.2;

const defaultEmptyOnboardingConfig: EmptyOnboardingConfig = {
  variant: "full",
  exiting: false,
  typingAccent: false,
  onExitComplete: () => {},
};

function EmptyStreamOnboarding({
  variant,
  exiting,
  typingAccent,
  onExitComplete,
  reduceMotion,
  deferEmptyPanelMotion = false,
  revealEmptyOnboarding = true,
}: EmptyOnboardingConfig & {
  reduceMotion: boolean | null;
  deferEmptyPanelMotion?: boolean;
  revealEmptyOnboarding?: boolean;
}) {
  const onboardingItem = reduceMotion ? emptyOnboardingInstant : emptyOnboardingItem;
  const onboardingContainer = reduceMotion
    ? emptyOnboardingContainerInstant
    : emptyOnboardingContainer;

  const focusFieldKbd = useMemo(() => {
    if (typeof navigator === "undefined") return "⌘N";
    return /Mac|iPhone|iPad/i.test(navigator.userAgent) ? "⌘N" : "Ctrl+N";
  }, []);

  const exitDuration = reduceMotion ? 0.12 : ONBOARDING_EXIT_S;
  const innerPhase = revealEmptyOnboarding ? "visible" : "hidden";

  return (
    <motion.div
      className="stream-empty stream-empty-onboarding stream-empty-onboarding--progressive"
      aria-live="polite"
      initial={false}
      animate={{
        opacity: exiting ? 0 : variant === "soft" ? 0.58 : 1,
      }}
      transition={{
        duration: exiting ? exitDuration : 0,
        ease: "easeOut",
      }}
      onAnimationComplete={() => {
        if (exiting) onExitComplete();
      }}
      style={{ pointerEvents: "none" }}
    >
      {/* Entrance = same stagger as after “typed then cleared”: inner hidden → visible only when revealEmptyOnboarding. */}
      <motion.div
        className="stream-empty-onboarding-inner"
        variants={onboardingContainer}
        initial="hidden"
        animate={innerPhase}
      >
        <motion.div className="stream-empty-onboarding-visual" variants={onboardingItem}>
          <StreamFlowPanel
            calm={!!reduceMotion}
            typingAccent={typingAccent && !exiting}
            deferMotion={deferEmptyPanelMotion && !reduceMotion}
          />
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
            <kbd className="stream-empty-kbd">{focusFieldKbd}</kbd> to start typing above
            <br />
            <br />
            <kbd className="stream-empty-kbd" aria-label="Enter" title="Enter">
              {ENTER_KEY_GLYPH}
            </kbd>{" "}
            to save
          </motion.p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function groupEntriesBySection(entries: Entry[]): { section: string; entries: Entry[] }[] {
  const groups = new Map<string, Entry[]>();
  const order: string[] = [];
  for (const entry of entries) {
    const { key } = getSectionMeta(entry.created_at);
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(entry);
  }
  return order.map((key) => ({
    section: key === "today" ? "Today" : key === "yesterday" ? "Yesterday" : getSectionMeta(groups.get(key)![0].created_at).label,
    entries: groups.get(key)!,
  }));
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

  const handleEditBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (!onEndEdit) return;
    const row = e.currentTarget.closest("article.entry-row");
    const rel = e.relatedTarget;
    if (row && rel instanceof Node && row.contains(rel)) return;
    setEditValue(entry.text);
    onEndEdit(entry.id);
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
            onBlur={handleEditBlur}
            onClick={(e) => e.stopPropagation()}
            aria-label="Edit thought"
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
            aria-label="Delete thought"
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
  section: string;
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
  emptyOnboarding,
  deferEmptyPanelMotion = false,
  revealEmptyOnboarding = true,
}) {
  const reduceMotion = useReducedMotion();

  const sections = useMemo(() => {
    if (sectionTitle) {
      return [{ section: sectionTitle, entries }];
    }
    return groupEntriesBySection(entries);
  }, [entries, sectionTitle]);

  /* Empty timeline: search vs progressive onboarding (single implementation). */
  if (entries.length === 0 && !sectionTitle) {
    if (showHighlights) {
      return (
        <p className="stream-empty" aria-live="polite">
          No thoughts match your search.
        </p>
      );
    }
    if (emptyOnboarding === null) {
      return (
        <div
          className="stream-empty stream-empty-onboarding stream-empty-onboarding--dismissed-placeholder"
          aria-hidden="true"
        />
      );
    }
    const onboardingConfig: EmptyOnboardingConfig =
      emptyOnboarding ?? defaultEmptyOnboardingConfig;
    return (
      <EmptyStreamOnboarding
        {...onboardingConfig}
        reduceMotion={reduceMotion}
        deferEmptyPanelMotion={deferEmptyPanelMotion}
        revealEmptyOnboarding={revealEmptyOnboarding}
      />
    );
  }

  if (entries.length === 0 && sectionTitle) {
    return null;
  }

  return (
    <div className="entry-stream" role="feed" aria-label={sectionTitle ?? "Thoughts"}>
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
