import { useState, useEffect, useCallback, useRef } from "react";
import { IntroScreen } from "@/components/IntroScreen";
import { LogoTransition } from "@/components/LogoTransition";
import { ChinottoLogo } from "@/components/ChinottoLogo";
import { ChinottoCard } from "@/components/ChinottoCard";
import { EntryInput, type EntryInputRef } from "./features/entries/EntryInput";
import { EntryStream } from "./features/entries/EntryStream";
import { EntryDetail } from "./features/entries/EntryDetail";
import { ResurfacedOverlay } from "./features/entries/ResurfacedOverlay";
import { VoiceCaptureOverlay } from "./features/entries/VoiceCaptureOverlay";
import { SearchInput } from "./features/entries/SearchInput";
import { Button } from "@/components/ui/button";
import {
  createEntry,
  updateEntry,
  listEntries,
  searchEntries,
  generateEmbedding,
  getResurfacedEntry,
  getPinnedEntryIds,
  pinEntry,
  unpinEntry,
  recordEntryOpen,
  deleteEntry,
} from "./features/entries/entryApi";
import type { Entry } from "./types/entry";
import { getStoredIconVariantId } from "@/lib/iconVariants";
import { setDesktopIcon } from "@/lib/setDesktopIcon";
import { listen } from "@tauri-apps/api/event";
import { getIdsInCooldown, markAsShown } from "@/lib/resurfaceSession";

/** Voice capture is disabled in the main flow. Set to true to re-enable as an experimental feature. */
const EXPERIMENTAL_VOICE_CAPTURE = false;

const RESURFACE_SHOW_PROBABILITY = 0.65;

function loadEntries(query: string): Promise<Entry[]> {
  return query.trim() ? searchEntries(query) : listEntries();
}

/** Dev-only: mock resurfaced entry so the overlay can be previewed when backend returns nothing */
function devMockResurfaced(): { entry: Entry; reason: string } {
  const d = new Date();
  d.setDate(d.getDate() - 3);
  return {
    entry: {
      id: "dev-mock-resurfaced",
      text: "This is a sample thought from the past. Click the card to open it, or press Enter / Esc to continue to the main screen.",
      created_at: d.toISOString(),
    },
    reason: "You wrote this 3 days ago.",
  };
}

export default function App() {
  const [introDismissed, setIntroDismissed] = useState(false);
  const [introTransitioning, setIntroTransitioning] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isChinottoCardOpen, setIsChinottoCardOpen] = useState(false);
  const [iconVariantId, setIconVariantId] = useState(() => getStoredIconVariantId());
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [resurfaced, setResurfaced] = useState<{
    entry: Entry;
    reason: string;
  } | null>(null);
  const [voiceCaptureOpen, setVoiceCaptureOpen] = useState(false);
  const [voiceCaptureMode, setVoiceCaptureMode] = useState<"shortcut" | "hold">("shortcut");
  const voiceHoldReleasedBeforeMountRef = useRef(false);
  const [justAddedEntryId, setJustAddedEntryId] = useState<string | null>(null);
  const [ephemeralEntryIds, setEphemeralEntryIds] = useState<Set<string>>(new Set());
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [settlingEntryIds, setSettlingEntryIds] = useState<Set<string>>(new Set());
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [lastDeletedEntry, setLastDeletedEntry] = useState<Entry | null>(null);
  const [hoveredEntryId, setHoveredEntryId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const entryInputRef = useRef<EntryInputRef>(null);
  const headerLogoRef = useRef<HTMLButtonElement>(null);
  const triedResurfaceRef = useRef(false);
  const shownThisSessionRef = useRef(false);
  const attemptedAfterSaveRef = useRef(false);
  const justAddedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ephemeralTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [logoEndRect, setLogoEndRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await loadEntries(search);
      setEntries(list);
      if (!search.trim()) {
        const ids = await getPinnedEntryIds();
        setPinnedIds(ids);
      }
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!introDismissed) {
      document.documentElement.classList.add("intro-open");
      document.body.classList.add("intro-open");
    } else {
      document.documentElement.classList.remove("intro-open");
      document.body.classList.remove("intro-open");
    }
    return () => {
      document.documentElement.classList.remove("intro-open");
      document.body.classList.remove("intro-open");
    };
  }, [introDismissed]);

  useEffect(() => {
    if (isChinottoCardOpen) {
      document.documentElement.classList.add("chinotto-card-open");
      document.body.classList.add("chinotto-card-open");
    } else {
      document.documentElement.classList.remove("chinotto-card-open");
      document.body.classList.remove("chinotto-card-open");
    }
    return () => {
      document.documentElement.classList.remove("chinotto-card-open");
      document.body.classList.remove("chinotto-card-open");
    };
  }, [isChinottoCardOpen]);

  useEffect(() => {
    setDesktopIcon(getStoredIconVariantId()).catch(() => {});
  }, []);

  useEffect(() => {
    if (!EXPERIMENTAL_VOICE_CAPTURE) return;
    const unlistenShortcut = listen("chinotto-voice-shortcut", () => {
      setVoiceCaptureMode("shortcut");
      setVoiceCaptureOpen(true);
    });
    const unlistenHoldStart = listen("chinotto-voice-hold-start", () => {
      voiceHoldReleasedBeforeMountRef.current = false;
      setVoiceCaptureMode("hold");
      setVoiceCaptureOpen(true);
    });
    const unlistenHoldStop = listen("chinotto-voice-hold-stop", () => {
      voiceHoldReleasedBeforeMountRef.current = true;
    });
    return () => {
      unlistenShortcut.then((u) => u());
      unlistenHoldStart.then((u) => u());
      unlistenHoldStop.then((u) => u());
    };
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      function onKeyDown(e: KeyboardEvent) {
        if ((e.metaKey || e.ctrlKey) && e.key === "r") {
          e.preventDefault();
          window.location.reload();
        }
        /* Force-show resurfaced overlay for testing: Ctrl+Shift+R (Cmd+Shift+R on Mac) */
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "R") {
          e.preventDefault();
          getResurfacedEntry(getIdsInCooldown()).then((r) => {
            if (r) setResurfaced(r);
          });
        }
      }
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, []);

  const resurfaceInFlightRef = useRef(false);
  const tryResurface = useCallback(() => {
    if (shownThisSessionRef.current || resurfaceInFlightRef.current) return;
    resurfaceInFlightRef.current = true;
    const excludeIds = getIdsInCooldown();
    getResurfacedEntry(excludeIds)
      .then((r) => {
        if (!r) return;
        if (Math.random() > RESURFACE_SHOW_PROBABILITY) return;
        shownThisSessionRef.current = true;
        markAsShown(r.entry.id);
        setResurfaced(r);
      })
      .finally(() => {
        resurfaceInFlightRef.current = false;
      });
  }, []);

  useEffect(() => {
    if (
      !introDismissed ||
      selectedEntry !== null ||
      loading ||
      search.trim() !== "" ||
      isSearchOpen ||
      editingEntryId !== null ||
      triedResurfaceRef.current
    ) {
      return;
    }
    triedResurfaceRef.current = true;
    tryResurface();
  }, [introDismissed, selectedEntry, loading, search, isSearchOpen, editingEntryId, tryResurface]);

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (selectedEntry) {
          setSelectedEntry(null);
          e.preventDefault();
        }
        return;
      }
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === "n" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (selectedEntry) setSelectedEntry(null);
        if (isSearchOpen) setIsSearchOpen(false);
        entryInputRef.current?.focus();
      }
      if (EXPERIMENTAL_VOICE_CAPTURE && (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        setVoiceCaptureMode("shortcut");
        setVoiceCaptureOpen(true);
      }
      if (EXPERIMENTAL_VOICE_CAPTURE && e.altKey && e.key === " " && !e.repeat && !voiceCaptureOpen) {
        e.preventDefault();
        voiceHoldReleasedBeforeMountRef.current = false;
        setVoiceCaptureMode("hold");
        setVoiceCaptureOpen(true);
        const handleHoldKeyUp = (e2: KeyboardEvent) => {
          if (e2.key !== " " && e2.key !== "Alt" && e2.key !== "Option") return;
          voiceHoldReleasedBeforeMountRef.current = true;
          window.removeEventListener("keyup", handleHoldKeyUp);
        };
        window.addEventListener("keyup", handleHoldKeyUp);
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [selectedEntry, voiceCaptureOpen, isSearchOpen]);

  const EPHEMERAL_WINDOW_MS = 15_000;
  const SETTLING_DURATION_MS = 200;

  async function handleSubmit(text: string) {
    const id = await createEntry(text);
    if (justAddedTimeoutRef.current) clearTimeout(justAddedTimeoutRef.current);
    setJustAddedEntryId(id);
    setEphemeralEntryIds((prev) => new Set(prev).add(id));
    const existing = ephemeralTimersRef.current.get(id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      ephemeralTimersRef.current.delete(id);
      setEphemeralEntryIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setSettlingEntryIds((prev) => new Set(prev).add(id));
      setTimeout(() => {
        setSettlingEntryIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, SETTLING_DURATION_MS);
    }, EPHEMERAL_WINDOW_MS);
    ephemeralTimersRef.current.set(id, t);
    justAddedTimeoutRef.current = setTimeout(() => {
      setJustAddedEntryId(null);
      justAddedTimeoutRef.current = null;
    }, 400);
    refresh();
    generateEmbedding(id);
    if (!shownThisSessionRef.current && !attemptedAfterSaveRef.current) {
      attemptedAfterSaveRef.current = true;
      setTimeout(() => tryResurface(), 500);
    }
  }

  function handleSearchClose() {
    setIsSearchOpen(false);
    setSearch("");
  }

  const handleOpenEntry = useCallback((entry: Entry) => {
    recordEntryOpen(entry.id);
    setSelectedEntry(entry);
  }, []);

  const refreshPinned = useCallback(() => {
    getPinnedEntryIds().then(setPinnedIds);
  }, []);

  const handlePin = useCallback(
    (entry: Entry) => {
      pinEntry(entry.id).then(refreshPinned);
    },
    [refreshPinned]
  );

  const handleUnpin = useCallback(
    (entry: Entry) => {
      unpinEntry(entry.id).then(refreshPinned);
    },
    [refreshPinned]
  );

  const handleEntryDelete = useCallback((entry: Entry) => {
    setDeletingIds((prev) => new Set(prev).add(entry.id));
    setLastDeletedEntry(entry);
    if (selectedEntry?.id === entry.id) setSelectedEntry(null);
    deleteEntry(entry.id).catch(() => {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
      setLastDeletedEntry(null);
    });
  }, [selectedEntry?.id]);

  const handleDeleteAnimationEnd = useCallback((entryId: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    setPinnedIds((prev) => prev.filter((id) => id !== entryId));
    setDeletingIds((prev) => {
      const next = new Set(prev);
      next.delete(entryId);
      return next;
    });
  }, []);

  const handleEntryUpdate = useCallback(
    (entryId: string, text: string) => {
      const t = ephemeralTimersRef.current.get(entryId);
      if (t) {
        clearTimeout(t);
        ephemeralTimersRef.current.delete(entryId);
      }
      updateEntry(entryId, text).then(() => {
        setEntries((prev) =>
          prev.map((e) => (e.id === entryId ? { ...e, text } : e))
        );
        setSettlingEntryIds((prev) => new Set(prev).add(entryId));
        setEphemeralEntryIds((prev) => {
          const next = new Set(prev);
          next.delete(entryId);
          return next;
        });
        setEditingEntryId(null);
        setTimeout(() => {
          setSettlingEntryIds((prev) => {
            const next = new Set(prev);
            next.delete(entryId);
            return next;
          });
        }, 200);
      });
    },
    []
  );

  const handleStartLateEdit = useCallback((entry: Entry) => {
    setEditingEntryId(entry.id);
  }, []);

  const handleEndEdit = useCallback((entryId: string) => {
    const t = ephemeralTimersRef.current.get(entryId);
    if (t) {
      clearTimeout(t);
      ephemeralTimersRef.current.delete(entryId);
    }
    setSettlingEntryIds((prev) => new Set(prev).add(entryId));
    setEphemeralEntryIds((prev) => {
      const next = new Set(prev);
      next.delete(entryId);
      return next;
    });
    setEditingEntryId(null);
    setTimeout(() => {
      setSettlingEntryIds((prev) => {
        const next = new Set(prev);
        next.delete(entryId);
        return next;
      });
    }, 200);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey && lastDeletedEntry) {
        e.preventDefault();
        createEntry(lastDeletedEntry.text).then(() => {
          setLastDeletedEntry(null);
          refresh();
        });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lastDeletedEntry, refresh]);

  /* Cmd+Backspace: delete hovered entry (row only gets keydown when focused, so use global + hover) */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key !== "Backspace") return;
      if (!hoveredEntryId) return;
      const entry = entries.find((e) => e.id === hoveredEntryId);
      if (entry) {
        e.preventDefault();
        handleEntryDelete(entry);
        setHoveredEntryId(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hoveredEntryId, entries, handleEntryDelete]);

  /* Cmd+P: pin hovered entry (matches shortcut list in Chinotto Card) */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "p") return;
      if (!hoveredEntryId) return;
      if (pinnedIds.includes(hoveredEntryId)) return; /* already pinned */
      const entry = entries.find((e) => e.id === hoveredEntryId);
      if (entry) {
        e.preventDefault();
        handlePin(entry);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hoveredEntryId, entries, pinnedIds, handlePin]);

  /* Cmd+E: edit hovered/focused entry (ephemeral edit escape hatch) */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "e") return;
      if (!hoveredEntryId) return;
      const entry = entries.find((ent) => ent.id === hoveredEntryId);
      if (entry) {
        e.preventDefault();
        handleStartLateEdit(entry);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hoveredEntryId, entries, handleStartLateEdit]);

  /* Clean up ephemeral timers on unmount */
  useEffect(() => {
    return () => {
      ephemeralTimersRef.current.forEach((t) => clearTimeout(t));
      ephemeralTimersRef.current.clear();
    };
  }, []);

  const handleLogoTransitionEnd = useCallback(() => {
    setIntroDismissed(true);
    setIntroTransitioning(false);
    setLogoEndRect(null);
    entryInputRef.current?.focus();
  }, []);

  const handleDevPreviewResurface = useCallback(() => {
    getResurfacedEntry().then((r) => {
      if (r) {
        setResurfaced(r);
      } else if (import.meta.env.DEV) {
        setResurfaced(devMockResurfaced());
      }
    });
  }, []);

  const handleIntroDismissRequest = useCallback(() => {
    setIntroTransitioning(true);
    const rect = headerLogoRef.current?.getBoundingClientRect();
    if (rect) {
      setLogoEndRect({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
    } else {
      setTimeout(handleLogoTransitionEnd, 400);
    }
  }, [handleLogoTransitionEnd]);

  const mainAppClass = [
    "app-shell",
    !introDismissed && !introTransitioning && "main-app-behind",
    introTransitioning && "main-app-enter",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className={mainAppClass}>
        <div className="app-bg" aria-hidden="true" />
        <div className="app">
          <header
            className={`app-header ${introDismissed ? "app-header-visible" : ""}`}
            aria-hidden={!introDismissed}
          >
            <div className="app-header-brand">
              <button
                ref={headerLogoRef}
                type="button"
                className="app-header-logo"
                onClick={() => introDismissed && setIsChinottoCardOpen(true)}
                aria-label="About Chinotto"
                tabIndex={introDismissed ? 0 : -1}
              >
                <ChinottoLogo size={32} />
              </button>
              <span className="app-header-name">
                Chinotto <span className="app-header-beta" aria-hidden="true">β</span>
              </span>
            </div>
            {import.meta.env.DEV && introDismissed && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="dev-preview-resurface text-[var(--muted)] hover:text-[var(--fg-dim)] text-xs"
                onClick={handleDevPreviewResurface}
                aria-label="Preview resurfaced overlay (dev)"
              >
                Preview resurface
              </Button>
            )}
          </header>
          {isSearchOpen && (
            <div
              className="search-overlay"
              role="dialog"
              aria-label="Search"
              onClick={(e) => e.target === e.currentTarget && handleSearchClose()}
            >
              <div className="search-center search-reveal">
                <SearchInput
                  ref={searchInputRef}
                  value={search}
                  onChange={setSearch}
                  onClose={handleSearchClose}
                />
              </div>
            </div>
          )}
          <div className="entry-input-row">
            <EntryInput ref={entryInputRef} onSubmit={handleSubmit} />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="search-trigger-inline text-[var(--muted)] hover:text-[var(--fg-dim)]"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Search (⌘K)"
            >
              ⌘K
            </Button>
          </div>
      {loading ? (
        <p className="stream-loading">Loading…</p>
      ) : selectedEntry ? (
        <EntryDetail
          entry={selectedEntry}
          onBack={() => setSelectedEntry(null)}
          onSelectEntry={handleOpenEntry}
        />
      ) : (
        <>
          {!search.trim() && (() => {
            const pinnedEntries = pinnedIds
              .map((id) => entries.find((e) => e.id === id))
              .filter((e): e is Entry => e != null);
            const streamEntries = entries.filter((e) => !pinnedIds.includes(e.id));
            return (
              <>
                {pinnedEntries.length > 0 && (
                  <EntryStream
                    entries={pinnedEntries}
                    showHighlights={false}
                    justAddedEntryId={null}
                    ephemeralEntryIds={ephemeralEntryIds}
                    editingEntryId={editingEntryId}
                    settlingEntryIds={settlingEntryIds}
                    onEntryUpdate={handleEntryUpdate}
                    onStartLateEdit={handleStartLateEdit}
                    onEndEdit={handleEndEdit}
                    onEntryClick={handleOpenEntry}
                    sectionTitle="Pinned"
                    isPinnedSection
                    onPinToggle={handleUnpin}
                    onEntryDelete={handleEntryDelete}
                    deletingIds={deletingIds}
                    onDeleteAnimationEnd={handleDeleteAnimationEnd}
                    onEntryHover={(entry) => setHoveredEntryId(entry ? entry.id : null)}
                  />
                )}
                <EntryStream
                  entries={streamEntries}
                  showHighlights={!!search.trim()}
                  justAddedEntryId={justAddedEntryId}
                  ephemeralEntryIds={ephemeralEntryIds}
                  editingEntryId={editingEntryId}
                  settlingEntryIds={settlingEntryIds}
                  onEntryUpdate={handleEntryUpdate}
                  onStartLateEdit={handleStartLateEdit}
                  onEndEdit={handleEndEdit}
                  onEntryClick={handleOpenEntry}
                  onPinToggle={handlePin}
                  onEntryDelete={handleEntryDelete}
                  deletingIds={deletingIds}
                  onDeleteAnimationEnd={handleDeleteAnimationEnd}
                  onEntryHover={(entry) => setHoveredEntryId(entry ? entry.id : null)}
                />
              </>
            );
          })()}
          {search.trim() && (
            <EntryStream
              entries={entries}
              showHighlights={true}
              justAddedEntryId={null}
              ephemeralEntryIds={new Set()}
              editingEntryId={null}
              settlingEntryIds={new Set()}
              onEntryClick={handleOpenEntry}
              onEntryDelete={handleEntryDelete}
              deletingIds={deletingIds}
              onDeleteAnimationEnd={handleDeleteAnimationEnd}
              onEntryHover={(entry) => setHoveredEntryId(entry ? entry.id : null)}
            />
          )}
        </>
      )}
        </div>
        <div className="app-studio-signature" aria-hidden="true">
          <span>Bogart Labs</span>
        </div>
      </div>
      {!introDismissed && (
        <>
          <IntroScreen onDismissRequest={handleIntroDismissRequest} />
          <LogoTransition
            transitioning={introTransitioning}
            targetRect={logoEndRect}
            onTransitionEnd={handleLogoTransitionEnd}
          />
        </>
      )}
      {isChinottoCardOpen && (
        <ChinottoCard
          onClose={() => setIsChinottoCardOpen(false)}
          iconVariantId={iconVariantId}
          onIconVariantChange={setIconVariantId}
        />
      )}
      {resurfaced && (
        <ResurfacedOverlay
          entry={resurfaced.entry}
          reason={resurfaced.reason}
          onOpen={(entry) => {
            handleOpenEntry(entry);
            setResurfaced(null);
          }}
          onDismiss={() => setResurfaced(null)}
        />
      )}
      {EXPERIMENTAL_VOICE_CAPTURE && voiceCaptureOpen && (
        <VoiceCaptureOverlay
          mode={voiceCaptureMode}
          releasedBeforeMountRef={voiceHoldReleasedBeforeMountRef}
          onClose={() => setVoiceCaptureOpen(false)}
          onCreateEntry={async (text) => {
            try {
              await handleSubmit(text);
            } finally {
              setVoiceCaptureOpen(false);
            }
          }}
        />
      )}
    </>
  );
}
