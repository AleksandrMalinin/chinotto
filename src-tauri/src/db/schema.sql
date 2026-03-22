-- Single table for MVP
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  edit_count INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0
);

-- FTS5 virtual table (external content); content_rowid links to entries.rowid
CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
  text,
  content='entries',
  content_rowid='rowid'
);

-- Sync FTS on insert
CREATE TRIGGER IF NOT EXISTS entries_ai AFTER INSERT ON entries BEGIN
  INSERT INTO entries_fts(rowid, text) VALUES (new.rowid, new.text);
END;

-- Sync FTS on delete
CREATE TRIGGER IF NOT EXISTS entries_ad AFTER DELETE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, text) VALUES('delete', old.rowid, old.text);
END;

-- Sync FTS on update
CREATE TRIGGER IF NOT EXISTS entries_au AFTER UPDATE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, text) VALUES('delete', old.rowid, old.text);
  INSERT INTO entries_fts(rowid, text) VALUES (new.rowid, new.text);
END;

-- Embeddings for semantic similarity (vector = 384 f32, stored as BLOB)
CREATE TABLE IF NOT EXISTS entry_embeddings (
  entry_id TEXT PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
  embedding BLOB NOT NULL
);

-- Pinned thoughts (max 5; order by pinned_at desc = most recent first)
CREATE TABLE IF NOT EXISTS pinned_entries (
  entry_id TEXT PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
  pinned_at TEXT NOT NULL
);

-- Entry ids removed on desktop: Firestore pull must not re-insert them while the remote doc still exists (v1 ingest-only sync).
CREATE TABLE IF NOT EXISTS firestore_ingest_suppressed_ids (
  id TEXT PRIMARY KEY,
  suppressed_at TEXT NOT NULL
);
