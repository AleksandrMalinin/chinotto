import { useState, useEffect, useCallback, useRef } from "react";
import { IntroScreen } from "@/components/IntroScreen";
import { EntryInput, type EntryInputRef } from "./features/entries/EntryInput";
import { EntryStream } from "./features/entries/EntryStream";
import { EntryDetail } from "./features/entries/EntryDetail";
import { ResurfacedCard } from "./features/entries/ResurfacedCard";
import { SearchInput } from "./features/entries/SearchInput";
import { Button } from "@/components/ui/button";
import {
  createEntry,
  listEntries,
  searchEntries,
  generateEmbedding,
  getResurfacedEntry,
} from "./features/entries/entryApi";
import type { Entry } from "./types/entry";

function loadEntries(query: string): Promise<Entry[]> {
  return query.trim() ? searchEntries(query) : listEntries();
}

export default function App() {
  const [introDismissed, setIntroDismissed] = useState(false);
  const [introTransitioning, setIntroTransitioning] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [resurfaced, setResurfaced] = useState<{
    entry: Entry;
    reason: string;
  } | null>(null);
  const [justAddedEntryId, setJustAddedEntryId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const entryInputRef = useRef<EntryInputRef>(null);
  const triedResurfaceRef = useRef(false);
  const justAddedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await loadEntries(search);
      setEntries(list);
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
      }
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, []);

  useEffect(() => {
    if (
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
      if (r) setResurfaced(r);
    });
  }, [selectedEntry, loading, search]);

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
          <div className="app-search-corner">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="search-trigger-corner text-[var(--muted)] hover:text-[var(--fg-dim)]"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Search (⌘K)"
            >
              ⌘K
            </Button>
          </div>
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
          <EntryInput ref={entryInputRef} onSubmit={handleSubmit} />
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
          {resurfaced && (
            <ResurfacedCard
              entry={resurfaced.entry}
              reason={resurfaced.reason}
              onOpen={(entry) => {
                setSelectedEntry(entry);
                setResurfaced(null);
              }}
              onDismiss={() => setResurfaced(null)}
            />
          )}
          <EntryStream
            entries={entries}
            showHighlights={!!search.trim()}
            justAddedEntryId={justAddedEntryId}
            onEntryClick={setSelectedEntry}
          />
        </>
      )}
        </div>
      </div>
      {!introDismissed && (
        <IntroScreen
          onDismissRequest={() => setIntroTransitioning(true)}
          onDismiss={() => {
            setIntroDismissed(true);
            setIntroTransitioning(false);
            entryInputRef.current?.focus();
          }}
        />
      )}
    </>
  );
}
