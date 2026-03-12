import { useState, useEffect, useCallback, useRef } from "react";
import { IntroScreen } from "@/components/IntroScreen";
import { LogoTransition } from "@/components/LogoTransition";
import { ChinottoLogo } from "@/components/ChinottoLogo";
import { ChinottoCard } from "@/components/ChinottoCard";
import { EntryInput, type EntryInputRef } from "./features/entries/EntryInput";
import { EntryStream } from "./features/entries/EntryStream";
import { EntryDetail } from "./features/entries/EntryDetail";
import { ResurfacedOverlay } from "./features/entries/ResurfacedOverlay";
import { SearchInput } from "./features/entries/SearchInput";
import { Button } from "@/components/ui/button";
import {
  createEntry,
  listEntries,
  searchEntries,
  generateEmbedding,
  getResurfacedEntry,
  getPinnedEntryIds,
  pinEntry,
  unpinEntry,
} from "./features/entries/entryApi";
import type { Entry } from "./types/entry";

const RESURFACED_RECENT_KEY = "chinotto-resurfaced-recent";
const RESURFACED_RECENT_MAX = 3;

function getRecentlyShownIds(): string[] {
  try {
    const raw = localStorage.getItem(RESURFACED_RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.slice(0, RESURFACED_RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function markAsShown(id: string): void {
  const recent = getRecentlyShownIds();
  const next = [id, ...recent.filter((x) => x !== id)].slice(0, RESURFACED_RECENT_MAX);
  try {
    localStorage.setItem(RESURFACED_RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

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
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [resurfaced, setResurfaced] = useState<{
    entry: Entry;
    reason: string;
  } | null>(null);
  const [justAddedEntryId, setJustAddedEntryId] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const entryInputRef = useRef<EntryInputRef>(null);
  const headerLogoRef = useRef<HTMLButtonElement>(null);
  const triedResurfaceRef = useRef(false);
  const justAddedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    if (import.meta.env.DEV) {
      function onKeyDown(e: KeyboardEvent) {
        if ((e.metaKey || e.ctrlKey) && e.key === "r") {
          e.preventDefault();
          window.location.reload();
        }
        /* Force-show resurfaced overlay for testing: Ctrl+Shift+R (Cmd+Shift+R on Mac) */
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "R") {
          e.preventDefault();
          getResurfacedEntry().then((r) => {
            if (r) setResurfaced(r);
          });
        }
      }
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, []);

  useEffect(() => {
    if (
      !introDismissed ||
      selectedEntry !== null ||
      loading ||
      search.trim() !== "" ||
      triedResurfaceRef.current
    ) {
      return;
    }
    if (Math.random() > 0.35) {
      triedResurfaceRef.current = true;
      return;
    }
    triedResurfaceRef.current = true;
    getResurfacedEntry().then((r) => {
      if (!r) return;
      const recent = getRecentlyShownIds();
      if (recent.includes(r.entry.id)) return;
      markAsShown(r.entry.id);
      setResurfaced(r);
    });
  }, [introDismissed, selectedEntry, loading, search]);

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
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedEntry]);

  async function handleSubmit(text: string) {
    const id = await createEntry(text);
    if (justAddedTimeoutRef.current) clearTimeout(justAddedTimeoutRef.current);
    setJustAddedEntryId(id);
    justAddedTimeoutRef.current = setTimeout(() => {
      setJustAddedEntryId(null);
      justAddedTimeoutRef.current = null;
    }, 400);
    refresh();
    generateEmbedding(id);
  }

  function handleSearchClose() {
    setIsSearchOpen(false);
    setSearch("");
  }

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
          onSelectEntry={setSelectedEntry}
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
                    onEntryClick={setSelectedEntry}
                    sectionTitle="Pinned"
                    isPinnedSection
                    onPinToggle={handleUnpin}
                  />
                )}
                <EntryStream
                  entries={streamEntries}
                  showHighlights={!!search.trim()}
                  justAddedEntryId={justAddedEntryId}
                  onEntryClick={setSelectedEntry}
                  onPinToggle={handlePin}
                />
              </>
            );
          })()}
          {search.trim() && (
            <EntryStream
              entries={entries}
              showHighlights={true}
              justAddedEntryId={null}
              onEntryClick={setSelectedEntry}
            />
          )}
        </>
      )}
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
        <ChinottoCard onClose={() => setIsChinottoCardOpen(false)} />
      )}
      {resurfaced && (
        <ResurfacedOverlay
          entry={resurfaced.entry}
          onOpen={(entry) => {
            setSelectedEntry(entry);
            setResurfaced(null);
          }}
          onDismiss={() => setResurfaced(null)}
        />
      )}
    </>
  );
}
