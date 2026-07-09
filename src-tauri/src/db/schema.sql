-- Spaces (stream lenses); seeded rows are referenced by entries.space_id. Inbox = space_id NULL.
CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

INSERT OR IGNORE INTO spaces (id, label, sort_order) VALUES ('work', 'Work', 1);
INSERT OR IGNORE INTO spaces (id, label, sort_order) VALUES ('personal', 'Personal', 2);

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  edit_count INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0,
  space_id TEXT REFERENCES spaces(id) ON DELETE SET NULL,
  continuation_from INTEGER,
  continuation_at TEXT
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

-- Pending Firestore tombstone writes (sync v2). One row per entry_id (coalesced).
CREATE TABLE IF NOT EXISTS sync_tombstone_outbox (
  entry_id TEXT PRIMARY KEY,
  enqueued_at TEXT NOT NULL
);

-- User theme ids removed on desktop: Firestore pull must not re-insert while remote doc still exists.
CREATE TABLE IF NOT EXISTS firestore_ingest_suppressed_theme_ids (
  id TEXT PRIMARY KEY,
  suppressed_at TEXT NOT NULL
);

-- Pending Firestore user_theme writes (sync Phase C). One row per theme_id (coalesced).
CREATE TABLE IF NOT EXISTS sync_user_theme_outbox (
  theme_id TEXT PRIMARY KEY,
  op TEXT NOT NULL CHECK (op IN ('upsert', 'tombstone')),
  label TEXT,
  sort_order INTEGER,
  enqueued_at TEXT NOT NULL
);

-- Private thread links (Slice 1: local registry; hosted read in Slice 2).
CREATE TABLE IF NOT EXISTS share_threads (
  token TEXT PRIMARY KEY,
  entry_ids TEXT NOT NULL,
  context_note TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

-- User-defined recall themes (max 7). keywords column unused (reserved). "links" is system URL detection.
CREATE TABLE IF NOT EXISTS user_themes (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  keywords TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

-- Ambient themes (recall metadata; not stream containers). See docs/internal/themes-proposal.md.
CREATE TABLE IF NOT EXISTS entry_themes (
  entry_id TEXT PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
  theme_id TEXT NOT NULL,
  confidence REAL NOT NULL,
  source TEXT NOT NULL,
  locked INTEGER NOT NULL DEFAULT 0,
  classified_at TEXT NOT NULL
);
