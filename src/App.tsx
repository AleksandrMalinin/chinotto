import { useState, useEffect, useCallback } from "react";
import { EntryInput } from "./features/entries/EntryInput";
import { EntryStream } from "./features/entries/EntryStream";
import { SearchInput } from "./features/entries/SearchInput";
import { createEntry, listEntries, searchEntries } from "./features/entries/entryApi";
import type { Entry } from "./types/entry";

function loadEntries(query: string): Promise<Entry[]> {
  return query.trim() ? searchEntries(query) : listEntries();
}

export default function App() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

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

  async function handleSubmit(text: string) {
    await createEntry(text);
    refresh();
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Chinotto</h1>
        <SearchInput value={search} onChange={setSearch} />
      </header>
      <EntryInput onSubmit={handleSubmit} disabled={loading} />
      {loading ? (
        <p className="stream-loading">Loading…</p>
      ) : (
        <EntryStream entries={entries} />
      )}
    </div>
  );
}
