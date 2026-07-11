import { useState, useEffect, useRef, useMemo } from "react";
import type { Entry } from "../../types/entry";
import { Button } from "@/components/ui/button";
import { EntryTextWithLinks } from "./EntryTextWithLinks";
import { track } from "@/lib/analytics";
import {
  recallThemeOptions,
  SYSTEM_THEME_LINKS,
  themeLabel,
  type UserTheme,
} from "@/lib/entryThemes";
import {
  findSimilarEntries,
  getEntry,
  getEntryTheme,
  getThoughtTrail,
  listSpaces,
  markEntryContinuation,
  setEntryTheme as persistEntryTheme,
  type ContinuationMarker,
  type EntryTheme,
  type SpaceRow,
} from "./entryApi";
import { detectContinuationAppend } from "@/lib/detectContinuationAppend";
import { ShareThreadDialog } from "./ShareThreadDialog";
import { ThoughtTrailStrip } from "./ThoughtTrailStrip";
import { DetailWriteOverlay } from "./DetailWriteOverlay";

type Props = {
  entry: Entry;
  onBack: () => void;
  onSelectEntry: (entry: Entry) => void;
  /** When set, thought body is editable with debounced save from the parent. */
  onEntryTextChange?: (entryId: string, text: string) => void;
  /** Expanded writing overlay open — shell can hide capture chrome. */
  onWriteExpandedChange?: (expanded: boolean) => void;
  /** After the first continuation break is stored for this entry. */
  onEntryContinuationMarked?: (
    entryId: string,
    marker: ContinuationMarker
  ) => void;
  /** Merge fresh entry fields from SQLite (e.g. after continuation save). */
  onEntrySynced?: (entry: Entry) => void;
  /** Assign entry to Inbox (null) or a seeded space (`work` / `personal`). */
  onEntrySpaceChange?: (
    entryId: string,
    spaceId: string | null
  ) => void | Promise<void>;
  /** Open search filtered to a theme (from detail meta). */
  onThemeSearch?: (themeId: string) => void;
  /** When false, theme meta and override are hidden (settings). */
  themesEnabled?: boolean;
  /** User-defined themes for labels and manual override. */
  userThemes?: UserTheme[];
  /** Scroll/focus thought trail when opened from resurface. */
  emphasizeTrail?: boolean;
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

/** Collapsed similar rows before "+N more". */
const SIMILAR_COLLAPSED_COUNT = 3;

const CARET_PULSE_ANIM_MS = 1200;

export function EntryDetail({
  entry,
  onBack,
  onSelectEntry,
  onEntryTextChange,
  onWriteExpandedChange,
  onEntryContinuationMarked,
  onEntrySynced,
  onEntrySpaceChange,
  onThemeSearch,
  themesEnabled = true,
  userThemes = [],
  emphasizeTrail = false,
}: Props) {
  const [related, setRelated] = useState<Entry[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(true);
  const [trail, setTrail] = useState<Entry[]>([]);
  const [trailLoading, setTrailLoading] = useState(true);
  const [continuationTrailHint, setContinuationTrailHint] = useState(false);
  const [spaceOptions, setSpaceOptions] = useState<SpaceRow[]>([]);
  const [spaceSaving, setSpaceSaving] = useState(false);
  /** After picking a space, :hover can stay true while the cursor rests on the control — fold until pointer leaves. */
  const [spaceLensDismissed, setSpaceLensDismissed] = useState(false);
  const [entryTheme, setEntryTheme] = useState<EntryTheme | null>(null);
  const [themeSaving, setThemeSaving] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const spaceSegments = useMemo(() => {
    const sorted = [...spaceOptions].sort((a, b) => a.sort_order - b.sort_order);
    return [
      { spaceId: null as string | null, label: "Inbox", key: "inbox" },
      ...sorted.map((s) => ({
        spaceId: s.id,
        label: s.label,
        key: s.id,
      })),
    ];
  }, [spaceOptions]);

  const currentSpaceLabel = useMemo(() => {
    const sid = entry.space_id ?? null;
    const seg = spaceSegments.find((s) => (s.spaceId ?? null) === sid);
    return seg?.label ?? "Inbox";
  }, [entry.space_id, spaceSegments]);

  const themeSegments = useMemo(
    () => [
      {
        themeId: SYSTEM_THEME_LINKS,
        label: "Links",
        key: SYSTEM_THEME_LINKS,
      },
      ...recallThemeOptions(userThemes).map((t) => ({
        themeId: t.id,
        label: t.label,
        key: t.id,
      })),
      { themeId: null as string | null, label: "None", key: "none" },
    ],
    [userThemes]
  );

  const assignedThemeId = entryTheme?.themeId ?? null;
  const assignedThemeLabel = assignedThemeId
    ? themeLabel(assignedThemeId, userThemes)
    : "None";

  const textRef = useRef<HTMLTextAreaElement>(null);
  const textAtEditStartRef = useRef("");
  const hasInsertedContinuationBreakRef = useRef(false);
  const editable = Boolean(onEntryTextChange);
  const [isEditingText, setIsEditingText] = useState(false);
  const [writeExpanded, setWriteExpanded] = useState(false);
  const [editDraft, setEditDraft] = useState(entry.text);
  const [similarExpanded, setSimilarExpanded] = useState(false);

  useEffect(() => {
    setIsEditingText(false);
    setWriteExpanded(false);
    setSimilarExpanded(false);
    setContinuationTrailHint(false);
    setTrail([]);
    setRelated([]);
    setEditDraft(entry.text);
    onWriteExpandedChange?.(false);
    hasInsertedContinuationBreakRef.current = false;
    setShareOpen(false);
    setEntryTheme(null);
    setThemePickerOpen(false);
  }, [entry.id, onWriteExpandedChange]);

  useEffect(() => {
    if (isEditingText || writeExpanded) return;
    setEditDraft(entry.text);
  }, [entry.text, entry.continuation_at, isEditingText, writeExpanded]);

  const persistEditDraft = (text: string) => {
    setEditDraft(text);
    onEntryTextChange?.(entry.id, text);
  };

  useEffect(() => {
    if (!editable || isEditingText || writeExpanded) return;
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "e") return;
      e.preventDefault();
      beginEditingText();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editable, isEditingText, writeExpanded]);

  useEffect(() => {
    setSpaceLensDismissed(false);
  }, [entry.id]);

  useEffect(() => {
    if (!themePickerOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setThemePickerOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [themePickerOpen]);

  useEffect(() => {
    if (!editable || !isEditingText || writeExpanded) return;
    let pulseClearTimer: ReturnType<typeof setTimeout> | null = null;
    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        innerRaf = 0;
        const el = textRef.current;
        if (!el) return;
        el.classList.remove("entry-detail-editable--caret-pulse");
        void el.offsetWidth;
        el.classList.add("entry-detail-editable--caret-pulse");
        pulseClearTimer = setTimeout(() => {
          el.classList.remove("entry-detail-editable--caret-pulse");
          pulseClearTimer = null;
        }, CARET_PULSE_ANIM_MS);
        el.focus({ preventScroll: true });
        const len = el.value.length;
        try {
          el.setSelectionRange(len, len);
        } catch {
          /* ignore */
        }
      });
    });
    return () => {
      cancelAnimationFrame(outerRaf);
      if (innerRaf) cancelAnimationFrame(innerRaf);
      if (pulseClearTimer) clearTimeout(pulseClearTimer);
    };
  }, [entry.id, editable, isEditingText, writeExpanded]);

  useEffect(() => {
    if (!editable || !isEditingText || writeExpanded) return;
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 88)}px`;
  }, [editDraft, editable, isEditingText, writeExpanded]);

  useEffect(() => {
    let cancelled = false;
    setRelatedLoading(true);
    findSimilarEntries(entry.id)
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
    listSpaces()
      .then((rows) => {
        if (!cancelled) setSpaceOptions(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const moveCaretToEnd = () => {
    const el = textRef.current;
    if (!el) return;
    const end = el.value.length;
    el.setSelectionRange(end, end);
  };

  const noteContinuationStart = (fromOffset: number, text: string) => {
    if (entry.continuation_from != null) return;
    onEntryContinuationMarked?.(entry.id, {
      continuation_from: fromOffset,
      continuation_at: new Date().toISOString(),
    });
    void markEntryContinuation(entry.id, fromOffset, text)
      .then((marker) => {
        if (marker) {
          onEntryContinuationMarked?.(entry.id, marker);
          setContinuationTrailHint(true);
        }
      })
      .catch(() => {});
  };

  const beginEditingText = () => {
    textAtEditStartRef.current = editDraft;
    hasInsertedContinuationBreakRef.current = false;
    setIsEditingText(true);
  };

  const openWriteExpanded = () => {
    if (!editable) return;
    if (!isEditingText) {
      textAtEditStartRef.current = editDraft;
      hasInsertedContinuationBreakRef.current = false;
    }
    setWriteExpanded(true);
    onWriteExpandedChange?.(true);
  };

  const closeWriteExpanded = () => {
    if (!writeExpanded) return;
    finalizeContinuationOnBlur(editDraft);
    setWriteExpanded(false);
    onWriteExpandedChange?.(false);
    setIsEditingText(false);
    window.setTimeout(() => {
      void getEntry(entry.id).then((fresh) => {
        if (fresh) onEntrySynced?.(fresh);
      });
    }, 400);
  };

  const handleTextBeforeInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    if (hasInsertedContinuationBreakRef.current) return;
    const native = e.nativeEvent as InputEvent;
    if (native.inputType !== "insertText" || !native.data) return;
    const el = e.currentTarget;
    const caretAtEnd =
      el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
    if (!caretAtEnd || el.value.length === 0 || el.value.endsWith("\n")) return;
    e.preventDefault();
    hasInsertedContinuationBreakRef.current = true;
    const end = el.value.length;
    el.setRangeText(`\n${native.data}`, end, end, "end");
    persistEditDraft(el.value);
    noteContinuationStart(end + 1, el.value);
  };

  const handleTextPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const pasted = e.clipboardData.getData("text");
    const caretAtEnd =
      el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
    if (
      pasted.length > 0 &&
      caretAtEnd &&
      el.value.length > 0 &&
      !el.value.endsWith("\n") &&
      !hasInsertedContinuationBreakRef.current
    ) {
      e.preventDefault();
      hasInsertedContinuationBreakRef.current = true;
      persistEditDraft(`${el.value}\n${pasted}`);
      noteContinuationStart(el.value.length + 1, `${el.value}\n${pasted}`);
      requestAnimationFrame(moveCaretToEnd);
    }
  };

  useEffect(() => {
    if (!editable || writeExpanded) return;
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey || e.key !== "Enter") return;
      e.preventDefault();
      openWriteExpanded();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editable, writeExpanded, entry.id, isEditingText]);

  const finalizeContinuationOnBlur = (finalText: string) => {
    if (entry.continuation_from != null) return;
    const detected = detectContinuationAppend(textAtEditStartRef.current, finalText);
    if (!detected) return;
    if (detected.normalizedText !== finalText) {
      persistEditDraft(detected.normalizedText);
    }
    noteContinuationStart(detected.fromOffset, detected.normalizedText);
  };

  const handleTextBlur = (finalText: string) => {
    finalizeContinuationOnBlur(finalText);
    setIsEditingText(false);
    window.setTimeout(() => {
      void getEntry(entry.id).then((fresh) => {
        if (fresh) onEntrySynced?.(fresh);
      });
    }, 400);
  };

  const beginExitToStream = () => {
    if (writeExpanded) {
      closeWriteExpanded();
    } else if (editable) {
      textRef.current?.blur();
    }
    onBack();
  };

  useEffect(() => {
    if (!themesEnabled) {
      setEntryTheme(null);
      return;
    }
    let cancelled = false;
    getEntryTheme(entry.id)
      .then((row) => {
        if (!cancelled) setEntryTheme(row);
      })
      .catch(() => {
        if (!cancelled) setEntryTheme(null);
      });
    return () => {
      cancelled = true;
    };
  }, [entry.id, themesEnabled]);

  useEffect(() => {
    let cancelled = false;
    setTrailLoading(true);
    getThoughtTrail(entry.id)
      .then((list) => {
        if (!cancelled) {
          setTrail(list);
          if (list.filter((e) => e.id !== entry.id).length > 0) {
            track({ event: "thought_trail_opened" });
          }
        }
      })
      .finally(() => {
        if (!cancelled) setTrailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entry.id]);

  const activateSpace = async (next: string | null) => {
    if (!onEntrySpaceChange) return;
    const current = entry.space_id ?? null;
    if (next === current) return;
    setSpaceSaving(true);
    try {
      await onEntrySpaceChange(entry.id, next);
      setSpaceLensDismissed(true);
      const ae = document.activeElement;
      if (ae instanceof HTMLElement) ae.blur();
    } finally {
      setSpaceSaving(false);
    }
  };

  const activateTheme = async (next: string | null) => {
    const current = assignedThemeId;
    if (next === current) return;
    setThemeSaving(true);
    try {
      await persistEntryTheme(entry.id, next, true);
      const row = await getEntryTheme(entry.id);
      setEntryTheme(row);
      setThemePickerOpen(false);
      const ae = document.activeElement;
      if (ae instanceof HTMLElement) ae.blur();
    } catch (err) {
      console.warn("[chinotto] persistEntryTheme failed", entry.id, err);
    } finally {
      setThemeSaving(false);
    }
  };

  const trailNeighbors = useMemo(
    () => trail.filter((e) => e.id !== entry.id),
    [trail, entry.id]
  );
  const trailEarlier = useMemo(
    () =>
      trailNeighbors.filter(
        (e) => new Date(e.created_at).getTime() < new Date(entry.created_at).getTime()
      ),
    [trailNeighbors, entry.created_at]
  );
  const trailLater = useMemo(
    () =>
      trailNeighbors.filter(
        (e) => new Date(e.created_at).getTime() > new Date(entry.created_at).getTime()
      ),
    [trailNeighbors, entry.created_at]
  );
  const trailNeighborIds = useMemo(
    () => new Set(trailNeighbors.map((e) => e.id)),
    [trailNeighbors]
  );
  const relatedBeyondTrail = useMemo(
    () => related.filter((e) => !trailNeighborIds.has(e.id)),
    [related, trailNeighborIds]
  );
  const showTrail = !trailLoading && trailNeighbors.length > 0;
  const showRelated = !relatedLoading && relatedBeyondTrail.length > 0;
  const shareTrailCount =
    trailNeighbors.length > 0 ? trailNeighbors.length + 1 : 1;
  const similarVisible = similarExpanded
    ? relatedBeyondTrail
    : relatedBeyondTrail.slice(0, SIMILAR_COLLAPSED_COUNT);
  const similarHiddenCount = Math.max(
    0,
    relatedBeyondTrail.length - similarVisible.length
  );
  const similarExceedsCollapsed =
    relatedBeyondTrail.length > SIMILAR_COLLAPSED_COUNT;
  const writingZoneClass = [
    "entry-detail-writing-zone",
    isEditingText && !writeExpanded ? "entry-detail-writing-zone--active" : "",
    editable && !isEditingText && !writeExpanded
      ? "entry-detail-writing-zone--readable"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={[
        "entry-detail entry-detail--focus",
        (isEditingText || writeExpanded) && "entry-detail--writing",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="entry-detail-focus-stage">
      <div className="entry-detail-toolbar">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="entry-detail-back h-auto min-h-0 px-0 py-1"
          onClick={beginExitToStream}
          aria-label="Back to stream"
        >
          ←
        </Button>
        <div className="entry-detail-toolbar-actions">
          {editable && !writeExpanded ? (
            <>
              <button
                type="button"
                className="entry-detail-toolbar-action"
                onClick={openWriteExpanded}
              >
                Expand
              </button>
              <span className="entry-detail-toolbar-sep" aria-hidden="true">
                ·
              </span>
            </>
          ) : null}
          <button
            type="button"
            className="entry-detail-toolbar-action"
            onClick={() => setShareOpen(true)}
          >
            {shareTrailCount >= 2 ? "Share thread" : "Share"}
          </button>
        </div>
      </div>
      {(onEntrySpaceChange || themesEnabled) ? (
        <div className="entry-detail-meta">
          <time className="entry-detail-time" dateTime={entry.created_at}>
            {formatTimestamp(entry.created_at)}
          </time>
          {onEntrySpaceChange ? (
            <div
              tabIndex={0}
              className={[
                spaceSaving
                  ? "entry-detail-space-hover entry-detail-space-hover--busy"
                  : "entry-detail-space-hover",
                spaceLensDismissed ? "entry-detail-space-hover--dismissed" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onMouseDown={(e) => {
                if (e.button === 0) (e.currentTarget as HTMLElement).focus();
              }}
              onMouseLeave={(e) => {
                const root = e.currentTarget as HTMLElement;
                const to = e.relatedTarget as Node | null;
                if (to && root.contains(to)) return;
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    if (!root.matches(":hover")) setSpaceLensDismissed(false);
                  });
                });
              }}
              aria-label={`Thought is in ${currentSpaceLabel}. Hover, click, or press Tab to move to another space.`}
            >
              <div className="entry-detail-space-hover-hint">
                <span
                  className="space-scope-tab space-scope-tab--active entry-detail-lens-tab"
                  aria-hidden="true"
                >
                  {currentSpaceLabel}
                </span>
              </div>
              <div className="entry-detail-space-hover-panel">
                <div
                  className={
                    spaceSaving
                      ? "header-space-lens-inner entry-detail-lens-inner entry-detail-lens-inner--busy"
                      : "header-space-lens-inner entry-detail-lens-inner"
                  }
                  role="tablist"
                  aria-label="Move to space"
                >
                  {spaceSegments.map((seg) => {
                    const active =
                      (entry.space_id ?? null) === (seg.spaceId ?? null);
                    return (
                      <button
                        key={seg.key}
                        type="button"
                        role="tab"
                        disabled={spaceSaving}
                        aria-selected={active}
                        className={
                          active
                            ? "space-scope-tab space-scope-tab--active entry-detail-lens-tab"
                            : "space-scope-tab entry-detail-lens-tab"
                        }
                        onClick={() => void activateSpace(seg.spaceId)}
                      >
                        {seg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <time className="entry-detail-time" dateTime={entry.created_at}>
          {formatTimestamp(entry.created_at)}
        </time>
      )}
      {themesEnabled ? (
        <div className="entry-detail-theme-block">
          {themePickerOpen ? (
            <div
              className={
                themeSaving
                  ? "entry-detail-theme-picker entry-detail-theme-picker--busy"
                  : "entry-detail-theme-picker"
              }
              role="radiogroup"
              aria-label="Choose theme"
            >
              {themeSegments.map((seg) => {
                const active = assignedThemeId === (seg.themeId ?? null);
                return (
                  <button
                    key={seg.key}
                    type="button"
                    role="radio"
                    disabled={themeSaving}
                    aria-checked={active}
                    className={
                      active
                        ? "entry-detail-theme-chip entry-detail-theme-chip--active"
                        : "entry-detail-theme-chip"
                    }
                    onClick={() => {
                      if (active) {
                        setThemePickerOpen(false);
                        return;
                      }
                      void activateTheme(seg.themeId);
                    }}
                  >
                    {seg.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="entry-detail-theme-summary">
              <button
                type="button"
                className={
                  assignedThemeId
                    ? "entry-detail-theme-trigger entry-detail-theme-trigger--set"
                    : "entry-detail-theme-trigger"
                }
                aria-expanded={false}
                aria-label={`Theme: ${assignedThemeLabel}. Choose theme`}
                onClick={() => setThemePickerOpen(true)}
              >
                {assignedThemeLabel}
              </button>
              {assignedThemeId && onThemeSearch ? (
                <button
                  type="button"
                  className="entry-detail-theme-browse"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onThemeSearch(assignedThemeId)}
                >
                  Browse
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
      {editable && onEntryTextChange ? (
        <div className={writingZoneClass}>
          {isEditingText ? (
            <textarea
              ref={textRef}
              className={[
                "entry-detail-editable",
                writeExpanded ? "entry-detail-zone-frozen" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label="Thought text"
              aria-hidden={writeExpanded}
              tabIndex={writeExpanded ? -1 : 0}
              readOnly={writeExpanded}
              value={editDraft}
              rows={4}
              onFocus={() => {
                if (writeExpanded) return;
                moveCaretToEnd();
              }}
              onClick={(e) => {
                if (writeExpanded) return;
                if (e.currentTarget !== document.activeElement) {
                  moveCaretToEnd();
                }
              }}
              onBlur={() => {
                if (writeExpanded) return;
                handleTextBlur(textRef.current?.value ?? editDraft);
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.max(el.scrollHeight, 88)}px`;
              }}
              onBeforeInput={handleTextBeforeInput}
              onKeyDown={(e) => {
                if (writeExpanded) return;
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.currentTarget.blur();
                  return;
                }
                if (
                  e.key === "Enter" &&
                  e.shiftKey &&
                  (e.metaKey || e.ctrlKey)
                ) {
                  e.preventDefault();
                  openWriteExpanded();
                }
              }}
              onPaste={handleTextPaste}
              onChange={(e) => persistEditDraft(e.target.value)}
            />
          ) : (
            <div
              className={[
                "entry-detail-text-readable",
                writeExpanded ? "entry-detail-zone-frozen" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              role={writeExpanded ? undefined : "button"}
              tabIndex={writeExpanded ? -1 : 0}
              aria-hidden={writeExpanded}
              aria-label={writeExpanded ? undefined : "Thought text, click to edit"}
              onClick={writeExpanded ? undefined : () => beginEditingText()}
              onKeyDown={
                writeExpanded
                  ? undefined
                  : (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        beginEditingText();
                      }
                    }
              }
            >
              <EntryTextWithLinks
                text={entry.text}
                variant="detail"
                continuationFrom={entry.continuation_from}
                continuationAt={entry.continuation_at}
              />
            </div>
          )}
        </div>
      ) : (
        <EntryTextWithLinks
          text={entry.text}
          variant="detail"
          continuationFrom={entry.continuation_from}
          continuationAt={entry.continuation_at}
        />
      )}
      {showTrail ? (
        <ThoughtTrailStrip
          entryId={entry.id}
          currentEntry={entry}
          currentCreatedAt={entry.created_at}
          earlier={trailEarlier}
          later={trailLater}
          onSelectEntry={onSelectEntry}
          emphasizeOnMount={emphasizeTrail}
        />
      ) : null}
      {continuationTrailHint && trailEarlier.length > 0 ? (
        <p className="entry-detail-continuation-trail-hint" role="status">
          Continuation added —{" "}
          <button
            type="button"
            className="entry-detail-continuation-trail-link"
            onClick={() => onSelectEntry(trailEarlier[trailEarlier.length - 1]!)}
          >
            see earlier in trail
          </button>
        </p>
      ) : null}
      {showRelated ? (
        <section
          className={[
            "entry-detail-similar",
            showTrail ? "entry-detail-similar--below-trail" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label="Related thoughts"
        >
          <h2 className="entry-detail-similar-title">Related thoughts</h2>
          <ul className="entry-detail-similar-list">
            {similarVisible.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className="entry-detail-similar-item"
                  onClick={() => onSelectEntry(e)}
                  aria-label={truncate(e.text, 60)}
                >
                  <span className="entry-detail-similar-text">
                    {truncate(e.text, 100)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {similarExceedsCollapsed ? (
            <button
              type="button"
              className="entry-detail-rail-more"
              aria-expanded={similarExpanded}
              onClick={() => setSimilarExpanded((v) => !v)}
            >
              {similarExpanded ? "Show less" : `+${similarHiddenCount} more`}
            </button>
          ) : null}
        </section>
      ) : null}
      </div>
      {shareOpen ? (
        <ShareThreadDialog
          currentEntry={entry}
          trailEntries={trail}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
      <DetailWriteOverlay
        open={writeExpanded}
        value={editDraft}
        onChange={persistEditDraft}
        onClose={closeWriteExpanded}
        onBeforeInput={handleTextBeforeInput}
        onPaste={handleTextPaste}
      />
    </div>
  );
}
