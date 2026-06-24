mod schema;

use chrono::{DateTime, Datelike, Local, NaiveDate, Utc};
use rusqlite::Connection;
use std::collections::BTreeSet;
use std::path::PathBuf;
use std::sync::Mutex;

fn utc_dt_from_created_at(iso: &str) -> Option<DateTime<Utc>> {
    chrono::DateTime::parse_from_rfc3339(iso)
        .ok()
        .map(|dt| dt.with_timezone(&Utc))
}

fn local_naive_date_from_created_at(iso: &str) -> Option<NaiveDate> {
    let utc = utc_dt_from_created_at(iso)?;
    Some(utc.with_timezone(&Local).date_naive())
}

/// Build an FTS5 prefix query so partial words match (e.g. "cap" matches "capture").
/// Tokens are space-separated; each becomes "token*". Special chars " and - are escaped.
fn fts5_prefix_query(user_query: &str) -> String {
    let q = user_query.trim();
    if q.is_empty() {
        return String::new();
    }
    let tokens: Vec<String> = q
        .split_whitespace()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(|token| {
            let escaped = token.replace('"', "\"\"");
            if token.contains('"') || token.contains('-') {
                format!("\"{}\"*", escaped)
            } else {
                format!("{}*", token)
            }
        })
        .collect();
    tokens.join(" ")
}

/// Escape % and _ for use in SQLite LIKE (so they match literally).
fn escape_like(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        if c == '%' || c == '_' {
            out.push('\\');
        }
        out.push(c);
    }
    out
}

/// Wrap each case-insensitive occurrence of `query` in `text` with FTS highlight markers.
fn highlight_substring(text: &str, query: &str) -> String {
    let q = query.trim();
    if q.is_empty() {
        return text.to_string();
    }
    let text_lower = text.to_lowercase();
    let q_lower = q.to_lowercase();
    let mut out = String::with_capacity(text.len() + 32);
    let mut start = 0;
    while let Some(pos) = text_lower[start..].find(&q_lower) {
        let abs = start + pos;
        out.push_str(&text[start..abs]);
        out.push('\u{0001}');
        out.push_str(&text[abs..abs + q.len()]);
        out.push('\u{0002}');
        start = abs + q.len();
    }
    out.push_str(&text[start..]);
    out
}

/// Stream lens: all entries, Inbox-only (`space_id` NULL), or a row from `spaces`.
#[derive(Clone, Debug, Default)]
pub enum SpaceFilter {
    #[default]
    All,
    Inbox,
    Space(String),
}

#[derive(Clone, Debug)]
pub struct SpaceRow {
    pub id: String,
    pub label: String,
    pub sort_order: i32,
}

const ENTRY_SELECT: &str =
    "id, text, created_at, updated_at, COALESCE(edit_count, 0), COALESCE(open_count, 0), space_id, continuation_from, continuation_at";

fn ensure_spaces(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS spaces (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            sort_order INTEGER NOT NULL
        );
        INSERT OR IGNORE INTO spaces (id, label, sort_order) VALUES ('work', 'Work', 1);
        INSERT OR IGNORE INTO spaces (id, label, sort_order) VALUES ('personal', 'Personal', 2);
    "#,
    )?;
    let has_column = conn.query_row(
        "SELECT 1 FROM pragma_table_info('entries') WHERE name = 'space_id'",
        [],
        |r| r.get::<_, i32>(0),
    );
    if !matches!(has_column, Ok(1)) {
        conn.execute(
            "ALTER TABLE entries ADD COLUMN space_id TEXT REFERENCES spaces(id) ON DELETE SET NULL",
            [],
        )?;
    }
    Ok(())
}

pub struct Db(Mutex<Connection>);

fn ensure_importance_columns(conn: &Connection) -> Result<(), rusqlite::Error> {
    let has_column = conn.query_row(
        "SELECT 1 FROM pragma_table_info('entries') WHERE name = 'edit_count'",
        [],
        |r| r.get::<_, i32>(0),
    );
    match has_column {
        Ok(1) => return Ok(()),
        _ => {}
    }
    conn.execute(
        "ALTER TABLE entries ADD COLUMN edit_count INTEGER DEFAULT 0",
        [],
    )?;
    conn.execute(
        "ALTER TABLE entries ADD COLUMN open_count INTEGER DEFAULT 0",
        [],
    )?;
    Ok(())
}

fn ensure_continuation_columns(conn: &Connection) -> Result<(), rusqlite::Error> {
    for col in ["continuation_from", "continuation_at"] {
        let has_column = conn.query_row(
            &format!("SELECT 1 FROM pragma_table_info('entries') WHERE name = '{col}'"),
            [],
            |r| r.get::<_, i32>(0),
        );
        if !matches!(has_column, Ok(1)) {
            let sql = if col == "continuation_from" {
                "ALTER TABLE entries ADD COLUMN continuation_from INTEGER"
            } else {
                "ALTER TABLE entries ADD COLUMN continuation_at TEXT"
            };
            conn.execute(sql, [])?;
        }
    }
    Ok(())
}

/// JS string index (UTF-16 code units) → byte index in Rust `str`.
fn js_offset_to_byte(text: &str, js_offset: usize) -> Option<usize> {
    let mut utf16 = 0usize;
    for (byte_i, ch) in text.char_indices() {
        if utf16 == js_offset {
            return Some(byte_i);
        }
        utf16 += ch.len_utf16();
    }
    if utf16 == js_offset {
        return Some(text.len());
    }
    None
}

fn continuation_marker_valid(text: &str, js_offset: i32) -> bool {
    if js_offset < 1 {
        return false;
    }
    let Some(byte_idx) = js_offset_to_byte(text, js_offset as usize) else {
        return false;
    };
    byte_idx > 0 && text.as_bytes().get(byte_idx - 1) == Some(&b'\n')
}

fn ensure_share_threads_table(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS share_threads (
            token TEXT PRIMARY KEY,
            entry_ids TEXT NOT NULL,
            context_note TEXT,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            revoked_at TEXT
        );
        "#,
    )?;
    Ok(())
}

fn ensure_updated_at_column(conn: &Connection) -> Result<(), rusqlite::Error> {
    let has_column = conn.query_row(
        "SELECT 1 FROM pragma_table_info('entries') WHERE name = 'updated_at'",
        [],
        |r| r.get::<_, i32>(0),
    );
    if !matches!(has_column, Ok(1)) {
        conn.execute(
            "ALTER TABLE entries ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''",
            [],
        )?;
        conn.execute(
            "UPDATE entries SET updated_at = created_at WHERE updated_at = ''",
            [],
        )?;
    }
    Ok(())
}

impl Db {
    pub fn open(path: PathBuf) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open(path)?;
        schema::run_migrations(&conn)?;
        ensure_importance_columns(&conn)?;
        ensure_updated_at_column(&conn)?;
        ensure_continuation_columns(&conn)?;
        ensure_share_threads_table(&conn)?;
        ensure_spaces(&conn)?;
        Ok(Self(Mutex::new(conn)))
    }

    /// Returns true if `id` exists in `spaces` (for assignable space ids, not Inbox).
    pub fn space_id_valid(&self, id: &str) -> Result<bool, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let n: i32 = conn.query_row(
            "SELECT COUNT(*) FROM spaces WHERE id = ?1",
            [id],
            |r| r.get(0),
        )?;
        Ok(n > 0)
    }

    pub fn list_spaces(&self) -> Result<Vec<SpaceRow>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, label, sort_order FROM spaces ORDER BY sort_order ASC, id ASC",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok(SpaceRow {
                id: r.get(0)?,
                label: r.get(1)?,
                sort_order: r.get(2)?,
            })
        })?;
        rows.collect()
    }

    pub fn create_entry(
        &self,
        id: &str,
        text: &str,
        created_at: &str,
        space_id: Option<&str>,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "INSERT INTO entries (id, text, created_at, updated_at, space_id) VALUES (?1, ?2, ?3, ?3, ?4)",
            rusqlite::params![id, text, created_at, space_id],
        )?;
        conn.execute(
            "DELETE FROM firestore_ingest_suppressed_ids WHERE id = ?1",
            [id],
        )?;
        Ok(())
    }

    /// Firestore ingest (mobile sync.md): insert only when `id` is new; idempotent on retries.
    /// Skips empty text or unparseable `created_at` (RFC3339).
    pub fn ingest_firestore_entries(
        &self,
        entries: &[(String, String, String)],
    ) -> Result<u32, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let mut inserted: u32 = 0;
        for (id, text, created_at) in entries {
            let trimmed = text.trim();
            if trimmed.is_empty() {
                continue;
            }
            if chrono::DateTime::parse_from_rfc3339(created_at).is_err() {
                continue;
            }
            let suppressed: i32 = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM firestore_ingest_suppressed_ids WHERE id = ?1)",
                [id.as_str()],
                |r| r.get(0),
            )?;
            if suppressed != 0 {
                continue;
            }
            let n = conn.execute(
                "INSERT OR IGNORE INTO entries (id, text, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
                [id.as_str(), trimmed, created_at.as_str()],
            )?;
            if n > 0 {
                inserted += 1;
            }
        }
        Ok(inserted)
    }

    pub fn update_entry_text(&self, id: &str, text: &str) -> Result<(), rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let updated_at = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE entries SET text = ?1, updated_at = ?2, edit_count = COALESCE(edit_count, 0) + 1 WHERE id = ?3",
            rusqlite::params![text, updated_at, id],
        )?;
        let cont_from: Option<i32> = conn.query_row(
            "SELECT continuation_from FROM entries WHERE id = ?1",
            [id],
            |r| r.get(0),
        )?;
        if let Some(from) = cont_from {
            if !continuation_marker_valid(text, from) {
                conn.execute(
                    "UPDATE entries SET continuation_from = NULL, continuation_at = NULL WHERE id = ?1",
                    [id],
                )?;
            }
        }
        Ok(())
    }

    /// Marks where a later continuation starts (UTF-16 code unit offset). Set once per entry.
    pub fn mark_entry_continuation(
        &self,
        id: &str,
        from_offset: i32,
        text: &str,
    ) -> Result<Option<(i32, String)>, rusqlite::Error> {
        if !continuation_marker_valid(text, from_offset) {
            return Ok(None);
        }
        let conn = self.0.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        let n = conn.execute(
            "UPDATE entries SET continuation_from = ?1, continuation_at = ?2 WHERE id = ?3 AND continuation_from IS NULL",
            rusqlite::params![from_offset, now, id],
        )?;
        if n == 0 {
            let existing: Option<(i32, String)> = conn
                .query_row(
                    "SELECT continuation_from, continuation_at FROM entries WHERE id = ?1 AND continuation_from IS NOT NULL",
                    [id],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .ok();
            return Ok(existing);
        }
        Ok(Some((from_offset, now)))
    }

    pub fn update_entry_space(
        &self,
        id: &str,
        space_id: Option<&str>,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let updated_at = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE entries SET space_id = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![space_id, updated_at, id],
        )?;
        Ok(())
    }

    pub fn record_entry_open(&self, entry_id: &str) -> Result<(), rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "UPDATE entries SET open_count = COALESCE(open_count, 0) + 1 WHERE id = ?1",
            [entry_id],
        )?;
        Ok(())
    }

    pub fn list_entries(&self) -> Result<Vec<EntryRow>, rusqlite::Error> {
        self.list_entries_filtered(&SpaceFilter::All)
    }

    pub fn list_entries_filtered(
        &self,
        filter: &SpaceFilter,
    ) -> Result<Vec<EntryRow>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        match filter {
            SpaceFilter::All => {
                let sql = format!(
                    "SELECT {ENTRY_SELECT} FROM entries ORDER BY created_at DESC, id ASC"
                );
                let mut stmt = conn.prepare(&sql)?;
                let out: Vec<EntryRow> = stmt.query_map([], row_to_entry)?.collect::<Result<_, _>>()?;
                Ok(out)
            }
            SpaceFilter::Inbox => {
                let sql = format!(
                    "SELECT {ENTRY_SELECT} FROM entries WHERE space_id IS NULL ORDER BY created_at DESC, id ASC"
                );
                let mut stmt = conn.prepare(&sql)?;
                let out: Vec<EntryRow> = stmt.query_map([], row_to_entry)?.collect::<Result<_, _>>()?;
                Ok(out)
            }
            SpaceFilter::Space(id) => {
                let sql = format!(
                    "SELECT {ENTRY_SELECT} FROM entries WHERE space_id = ?1 ORDER BY created_at DESC, id ASC"
                );
                let mut stmt = conn.prepare(&sql)?;
                let out: Vec<EntryRow> =
                    stmt.query_map([id.as_str()], row_to_entry)?.collect::<Result<_, _>>()?;
                Ok(out)
            }
        }
    }

    /// Local calendar dates (YYYY-MM-DD) in `[year, month]` that have at least one entry.
    pub fn local_entry_dates_in_month(
        &self,
        year: i32,
        month: u32,
        filter: &SpaceFilter,
    ) -> Result<Vec<String>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let mut set = BTreeSet::new();
        let created_ats: Vec<String> = match filter {
            SpaceFilter::All => {
                let mut stmt = conn.prepare("SELECT created_at FROM entries")?;
                let v: Vec<String> = stmt
                    .query_map([], |r| r.get::<_, String>(0))?
                    .collect::<Result<_, _>>()?;
                v
            }
            SpaceFilter::Inbox => {
                let mut stmt =
                    conn.prepare("SELECT created_at FROM entries WHERE space_id IS NULL")?;
                let v: Vec<String> = stmt
                    .query_map([], |r| r.get::<_, String>(0))?
                    .collect::<Result<_, _>>()?;
                v
            }
            SpaceFilter::Space(id) => {
                let mut stmt =
                    conn.prepare("SELECT created_at FROM entries WHERE space_id = ?1")?;
                let v: Vec<String> = stmt
                    .query_map([id.as_str()], |r| r.get::<_, String>(0))?
                    .collect::<Result<_, _>>()?;
                v
            }
        };
        for created_at in created_ats {
            let Some(d) = local_naive_date_from_created_at(&created_at) else {
                continue;
            };
            if d.year() == year && d.month() == month {
                set.insert(d.format("%Y-%m-%d").to_string());
            }
        }
        Ok(set.into_iter().collect())
    }

    /// Newest entry on the given local calendar day (first row for that day in `created_at DESC` stream order).
    pub fn jump_anchor_entry_id_for_local_date(
        &self,
        target: NaiveDate,
        filter: &SpaceFilter,
    ) -> Result<Option<String>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let pairs: Vec<(String, String)> = match filter {
            SpaceFilter::All => {
                let mut stmt = conn.prepare("SELECT id, created_at FROM entries")?;
                let v: Vec<(String, String)> = stmt
                    .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?
                    .collect::<Result<_, _>>()?;
                v
            }
            SpaceFilter::Inbox => {
                let mut stmt =
                    conn.prepare("SELECT id, created_at FROM entries WHERE space_id IS NULL")?;
                let v: Vec<(String, String)> = stmt
                    .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?
                    .collect::<Result<_, _>>()?;
                v
            }
            SpaceFilter::Space(id) => {
                let mut stmt =
                    conn.prepare("SELECT id, created_at FROM entries WHERE space_id = ?1")?;
                let v: Vec<(String, String)> = stmt
                    .query_map([id.as_str()], |r| {
                        Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
                    })?
                    .collect::<Result<_, _>>()?;
                v
            }
        };
        let mut best: Option<(String, DateTime<Utc>)> = None;
        for (id, created_at) in pairs {
            let Some(d) = local_naive_date_from_created_at(&created_at) else {
                continue;
            };
            if d != target {
                continue;
            }
            let Some(ts) = utc_dt_from_created_at(&created_at) else {
                continue;
            };
            if best
                .as_ref()
                .map_or(true, |(_, t)| ts > *t)
            {
                best = Some((id, ts));
            }
        }
        Ok(best.map(|(id, _)| id))
    }

    pub fn get_entry_by_id(&self, id: &str) -> Result<Option<EntryRow>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let sql = format!("SELECT {ENTRY_SELECT} FROM entries WHERE id = ?1");
        let mut stmt = conn.prepare(&sql)?;
        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            return Ok(Some(row_to_entry(&row)?));
        }
        Ok(None)
    }

    pub fn insert_embedding(
        &self,
        entry_id: &str,
        embedding: &[f32],
    ) -> Result<(), rusqlite::Error> {
        let blob: Vec<u8> = embedding.iter().flat_map(|f| f.to_le_bytes()).collect();
        let conn = self.0.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO entry_embeddings (entry_id, embedding) VALUES (?1, ?2)",
            rusqlite::params![entry_id, blob],
        )?;
        Ok(())
    }

    pub fn get_embedding(&self, entry_id: &str) -> Result<Option<Vec<f32>>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let mut stmt =
            conn.prepare("SELECT embedding FROM entry_embeddings WHERE entry_id = ?1")?;
        let mut rows = stmt.query([entry_id])?;
        if let Some(row) = rows.next()? {
            let blob: Vec<u8> = row.get(0)?;
            let embedding: Vec<f32> = blob
                .chunks_exact(4)
                .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
                .collect();
            return Ok(Some(embedding));
        }
        Ok(None)
    }

    pub fn get_all_embeddings_excluding(
        &self,
        exclude_id: &str,
    ) -> Result<Vec<(String, Vec<f32>)>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let mut stmt =
            conn.prepare("SELECT entry_id, embedding FROM entry_embeddings WHERE entry_id != ?1")?;
        let rows = stmt.query_map([exclude_id], |row| {
            let entry_id: String = row.get(0)?;
            let blob: Vec<u8> = row.get(1)?;
            let embedding: Vec<f32> = blob
                .chunks_exact(4)
                .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
                .collect();
            Ok((entry_id, embedding))
        })?;
        rows.collect()
    }

    pub fn get_entries_by_ids(&self, ids: &[String]) -> Result<Vec<EntryRow>, rusqlite::Error> {
        if ids.is_empty() {
            return Ok(vec![]);
        }
        let conn = self.0.lock().unwrap();
        let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT {ENTRY_SELECT} FROM entries WHERE id IN ({})",
            placeholders
        );
        let mut stmt = conn.prepare(&sql)?;
        let mut rows = stmt.query(rusqlite::params_from_iter(ids.iter()))?;
        let mut out = vec![];
        while let Some(row) = rows.next()? {
            out.push(row_to_entry(&row)?);
        }
        Ok(out)
    }

    pub fn insert_pinned(&self, entry_id: &str) -> Result<(), rusqlite::Error> {
        let pinned_at = chrono::Utc::now().to_rfc3339();
        let conn = self.0.lock().unwrap();
        conn.execute(
            "INSERT INTO pinned_entries (entry_id, pinned_at) VALUES (?1, ?2)",
            [entry_id, &pinned_at],
        )?;
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM pinned_entries", [], |r| r.get(0))?;
        if count > 5 {
            conn.execute(
                "DELETE FROM pinned_entries WHERE entry_id = (
                  SELECT entry_id FROM pinned_entries ORDER BY pinned_at ASC LIMIT 1
                )",
                [],
            )?;
        }
        Ok(())
    }

    pub fn remove_pinned(&self, entry_id: &str) -> Result<(), rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        conn.execute("DELETE FROM pinned_entries WHERE entry_id = ?1", [entry_id])?;
        Ok(())
    }

    pub fn list_pinned_entry_ids(&self) -> Result<Vec<String>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let mut stmt =
            conn.prepare("SELECT entry_id FROM pinned_entries ORDER BY pinned_at DESC")?;
        let rows = stmt.query_map([], |r| r.get(0))?;
        rows.collect()
    }

    pub fn delete_entry(&self, entry_id: &str) -> Result<(), rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        conn.execute("DELETE FROM entries WHERE id = ?1", [entry_id])?;
        let at = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT OR REPLACE INTO firestore_ingest_suppressed_ids (id, suppressed_at) VALUES (?1, ?2)",
            [entry_id, at.as_str()],
        )?;
        Ok(())
    }

    /// Remove every entry and related rows (pins, embeddings). For local debug tooling.
    pub fn delete_all_entries(&self) -> Result<(), rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        conn.execute("DELETE FROM pinned_entries", [])?;
        conn.execute("DELETE FROM entry_embeddings", [])?;
        conn.execute("DELETE FROM entries", [])?;
        conn.execute("DELETE FROM firestore_ingest_suppressed_ids", [])?;
        conn.execute("DELETE FROM sync_tombstone_outbox", [])?;
        Ok(())
    }

    /// Coalesce: one pending tombstone per entry id (sync v2).
    pub fn enqueue_sync_tombstone(&self, entry_id: &str) -> Result<(), rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let at = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT OR REPLACE INTO sync_tombstone_outbox (entry_id, enqueued_at) VALUES (?1, ?2)",
            [entry_id, at.as_str()],
        )?;
        Ok(())
    }

    pub fn list_sync_tombstone_outbox(&self) -> Result<Vec<String>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT entry_id FROM sync_tombstone_outbox ORDER BY enqueued_at ASC",
        )?;
        let rows = stmt.query_map([], |r| r.get(0))?;
        rows.collect()
    }

    pub fn remove_sync_tombstone_outbox(&self, entry_id: &str) -> Result<(), rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "DELETE FROM sync_tombstone_outbox WHERE entry_id = ?1",
            [entry_id],
        )?;
        Ok(())
    }

    /// Clears pending Firestore tombstone writes when the cloud session is gone (e.g. account deleted elsewhere).
    pub fn clear_sync_tombstone_outbox_all(&self) -> Result<(), rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        conn.execute("DELETE FROM sync_tombstone_outbox", [])?;
        Ok(())
    }

    pub fn clear_firestore_ingest_suppression(&self, entry_id: &str) -> Result<(), rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "DELETE FROM firestore_ingest_suppressed_ids WHERE id = ?1",
            [entry_id],
        )?;
        Ok(())
    }

    /// Remote tombstone (or sync apply): remove local row without adding suppression; clear suppression for this id.
    pub fn delete_local_entries_for_sync(&self, entry_ids: &[String]) -> Result<u32, rusqlite::Error> {
        if entry_ids.is_empty() {
            return Ok(0);
        }
        let conn = self.0.lock().unwrap();
        let mut removed: u32 = 0;
        for id in entry_ids {
            let n = conn.execute("DELETE FROM entries WHERE id = ?1", [id.as_str()])?;
            if n > 0 {
                removed += 1;
            }
            conn.execute(
                "DELETE FROM firestore_ingest_suppressed_ids WHERE id = ?1",
                [id.as_str()],
            )?;
        }
        Ok(removed)
    }

    pub fn search_entries_filtered(
        &self,
        query: &str,
        filter: &SpaceFilter,
    ) -> Result<Vec<SearchEntryRow>, rusqlite::Error> {
        if query.trim().is_empty() {
            let rows = self.list_entries_filtered(filter)?;
            return Ok(rows
                .into_iter()
                .map(|r| SearchEntryRow {
                    id: r.id,
                    text: r.text,
                    created_at: r.created_at,
                    highlighted: None,
                    space_id: r.space_id,
                })
                .collect());
        }
        let conn = self.0.lock().unwrap();
        let prefix_query = fts5_prefix_query(query);

        if !prefix_query.is_empty() {
            let fts_sql_all = "SELECT e.id, e.text, e.created_at, e.space_id,
                    highlight(entries_fts, 0, '\u{0001}', '\u{0002}') AS highlighted
             FROM entries e
             INNER JOIN entries_fts ON e.rowid = entries_fts.rowid
             WHERE entries_fts MATCH ?1
             ORDER BY bm25(entries_fts)";
            let fts_sql_inbox = "SELECT e.id, e.text, e.created_at, e.space_id,
                    highlight(entries_fts, 0, '\u{0001}', '\u{0002}') AS highlighted
             FROM entries e
             INNER JOIN entries_fts ON e.rowid = entries_fts.rowid
             WHERE entries_fts MATCH ?1 AND e.space_id IS NULL
             ORDER BY bm25(entries_fts)";
            let fts_sql_space = "SELECT e.id, e.text, e.created_at, e.space_id,
                    highlight(entries_fts, 0, '\u{0001}', '\u{0002}') AS highlighted
             FROM entries e
             INNER JOIN entries_fts ON e.rowid = entries_fts.rowid
             WHERE entries_fts MATCH ?1 AND e.space_id = ?2
             ORDER BY bm25(entries_fts)";

            let fts_list: Option<Vec<SearchEntryRow>> = match filter {
                SpaceFilter::All => conn.prepare(fts_sql_all).ok().and_then(|mut stmt| {
                    stmt
                        .query_map([&prefix_query], fts_match_row)
                        .ok()
                        .and_then(|rows| rows.collect::<Result<Vec<_>, _>>().ok())
                }),
                SpaceFilter::Inbox => conn.prepare(fts_sql_inbox).ok().and_then(|mut stmt| {
                    stmt
                        .query_map([&prefix_query], fts_match_row)
                        .ok()
                        .and_then(|rows| rows.collect::<Result<Vec<_>, _>>().ok())
                }),
                SpaceFilter::Space(sid) => conn.prepare(fts_sql_space).ok().and_then(|mut stmt| {
                    stmt
                        .query_map(rusqlite::params![prefix_query, sid.as_str()], fts_match_row)
                        .ok()
                        .and_then(|rows| rows.collect::<Result<Vec<_>, _>>().ok())
                }),
            };
            if let Some(list) = fts_list {
                if !list.is_empty() {
                    return Ok(list);
                }
            }
        }

        let query_trim = query.trim();
        let like_pattern = format!("%{}%", escape_like(query_trim));
        match filter {
            SpaceFilter::All => {
                let fallback_sql = "SELECT id, text, created_at, space_id FROM entries WHERE LOWER(text) LIKE LOWER(?1) ESCAPE '\\' ORDER BY created_at DESC";
                let mut stmt = conn.prepare(fallback_sql)?;
                let rows = stmt.query_map([&like_pattern], |r| {
                    let id: String = r.get(0)?;
                    let text: String = r.get(1)?;
                    let created_at: String = r.get(2)?;
                    let space_id: Option<String> = r.get(3)?;
                    let highlighted = Some(highlight_substring(&text, query_trim));
                    Ok(SearchEntryRow {
                        id,
                        text,
                        created_at,
                        space_id,
                        highlighted,
                    })
                })?;
                rows.collect()
            }
            SpaceFilter::Inbox => {
                let fallback_sql = "SELECT id, text, created_at, space_id FROM entries WHERE LOWER(text) LIKE LOWER(?1) ESCAPE '\\' AND space_id IS NULL ORDER BY created_at DESC";
                let mut stmt = conn.prepare(fallback_sql)?;
                let rows = stmt.query_map([&like_pattern], |r| {
                    let id: String = r.get(0)?;
                    let text: String = r.get(1)?;
                    let created_at: String = r.get(2)?;
                    let space_id: Option<String> = r.get(3)?;
                    let highlighted = Some(highlight_substring(&text, query_trim));
                    Ok(SearchEntryRow {
                        id,
                        text,
                        created_at,
                        space_id,
                        highlighted,
                    })
                })?;
                rows.collect()
            }
            SpaceFilter::Space(sid) => {
                let fallback_sql = "SELECT id, text, created_at, space_id FROM entries WHERE LOWER(text) LIKE LOWER(?1) ESCAPE '\\' AND space_id = ?2 ORDER BY created_at DESC";
                let mut stmt = conn.prepare(fallback_sql)?;
                let rows =
                    stmt.query_map(rusqlite::params![like_pattern, sid.as_str()], |r| {
                        let id: String = r.get(0)?;
                        let text: String = r.get(1)?;
                        let created_at: String = r.get(2)?;
                        let space_id: Option<String> = r.get(3)?;
                        let highlighted = Some(highlight_substring(&text, query_trim));
                        Ok(SearchEntryRow {
                            id,
                            text,
                            created_at,
                            space_id,
                            highlighted,
                        })
                    })?;
                rows.collect()
            }
        }
    }

    pub fn insert_share_thread(
        &self,
        token: &str,
        entry_ids: &[String],
        context_note: Option<&str>,
        created_at: &str,
        expires_at: &str,
    ) -> Result<(), rusqlite::Error> {
        let entry_ids_json = serde_json::to_string(entry_ids).map_err(|e| {
            rusqlite::Error::ToSqlConversionFailure(Box::new(e))
        })?;
        let conn = self.0.lock().unwrap();
        conn.execute(
            "INSERT INTO share_threads (token, entry_ids, context_note, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![token, entry_ids_json, context_note, created_at, expires_at],
        )?;
        Ok(())
    }

    pub fn get_share_thread_row(
        &self,
        token: &str,
    ) -> Result<Option<ShareThreadRow>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT token, entry_ids, context_note, created_at, expires_at, revoked_at FROM share_threads WHERE token = ?1",
        )?;
        let mut rows = stmt.query([token])?;
        if let Some(row) = rows.next()? {
            return Ok(Some(row_to_share_thread(&row)?));
        }
        Ok(None)
    }

    pub fn list_share_thread_rows(&self) -> Result<Vec<ShareThreadRow>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT token, entry_ids, context_note, created_at, expires_at, revoked_at FROM share_threads ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map([], row_to_share_thread)?;
        rows.collect()
    }

    pub fn revoke_share_thread(&self, token: &str) -> Result<bool, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let revoked_at = chrono::Utc::now().to_rfc3339();
        let n = conn.execute(
            "UPDATE share_threads SET revoked_at = ?1 WHERE token = ?2 AND revoked_at IS NULL",
            rusqlite::params![revoked_at, token],
        )?;
        Ok(n > 0)
    }
}

pub const MAX_SHARE_ENTRY_COUNT: usize = 15;

#[derive(Clone, Debug)]
pub struct ShareThreadRow {
    pub token: String,
    pub entry_ids: Vec<String>,
    pub context_note: Option<String>,
    pub created_at: String,
    pub expires_at: String,
    pub revoked_at: Option<String>,
}

pub fn share_thread_is_active(row: &ShareThreadRow) -> bool {
    if row.revoked_at.is_some() {
        return false;
    }
    let Ok(expires) = chrono::DateTime::parse_from_rfc3339(&row.expires_at) else {
        return false;
    };
    expires > chrono::Utc::now()
}

fn row_to_share_thread(r: &rusqlite::Row<'_>) -> Result<ShareThreadRow, rusqlite::Error> {
    let entry_ids_json: String = r.get(1)?;
    let entry_ids: Vec<String> = serde_json::from_str(&entry_ids_json).map_err(|e| {
        rusqlite::Error::FromSqlConversionFailure(
            1,
            rusqlite::types::Type::Text,
            Box::new(e),
        )
    })?;
    Ok(ShareThreadRow {
        token: r.get(0)?,
        entry_ids,
        context_note: r.get(2)?,
        created_at: r.get(3)?,
        expires_at: r.get(4)?,
        revoked_at: r.get(5)?,
    })
}

fn row_to_entry(r: &rusqlite::Row<'_>) -> Result<EntryRow, rusqlite::Error> {
    Ok(EntryRow {
        id: r.get(0)?,
        text: r.get(1)?,
        created_at: r.get(2)?,
        updated_at: r.get(3)?,
        edit_count: r.get::<_, i64>(4)? as u32,
        open_count: r.get::<_, i64>(5)? as u32,
        space_id: r.get(6)?,
        continuation_from: r.get(7)?,
        continuation_at: r.get(8)?,
    })
}

#[derive(Clone)]
pub struct EntryRow {
    pub id: String,
    pub text: String,
    pub created_at: String,
    pub updated_at: String,
    pub edit_count: u32,
    pub open_count: u32,
    pub space_id: Option<String>,
    pub continuation_from: Option<i32>,
    pub continuation_at: Option<String>,
}

pub struct SearchEntryRow {
    pub id: String,
    pub text: String,
    pub created_at: String,
    pub highlighted: Option<String>,
    pub space_id: Option<String>,
}

fn fts_match_row(r: &rusqlite::Row<'_>) -> Result<SearchEntryRow, rusqlite::Error> {
    Ok(SearchEntryRow {
        id: r.get(0)?,
        text: r.get(1)?,
        created_at: r.get(2)?,
        space_id: r.get(3)?,
        highlighted: Some(r.get(4)?),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn db_with_entries(entries: &[(&str, &str)]) -> Db {
        let db = Db::open(PathBuf::from(":memory:")).unwrap();
        for (i, (id, text)) in entries.iter().enumerate() {
            let created = format!("2025-01-{:02}T12:00:00Z", 15 - i);
            db.create_entry(id, text, &created, None).unwrap();
        }
        db
    }

    fn search_ids(db: &Db, query: &str) -> Vec<String> {
        db.search_entries_filtered(query, &SpaceFilter::All)
            .unwrap()
            .into_iter()
            .map(|r| r.id.to_string())
            .collect()
    }

    #[test]
    fn partial_word_search_matches_substrings_inside_words() {
        let db = db_with_entries(&[(
            "1",
            "1:1 with Sarah re: roadmap alignment and hiring plan for Q2",
        )]);
        for query in ["road", "roadmap", "align", "hir", "plan"] {
            let ids = search_ids(&db, query);
            assert!(
                ids.contains(&"1".to_string()),
                "query {:?} should match entry (substring inside word)",
                query
            );
        }
    }

    #[test]
    fn case_insensitive_matching() {
        let db = db_with_entries(&[("1", "Call Mom Tomorrow")]);
        for query in ["call", "CALL", "Call", "mom", "MOM", "ToMoRrOw"] {
            let ids = search_ids(&db, query);
            assert!(
                ids.contains(&"1".to_string()),
                "query {:?} should match (case-insensitive)",
                query
            );
        }
    }

    #[test]
    fn no_results_returns_empty() {
        let db = db_with_entries(&[("1", "1:1 with Sarah re: roadmap alignment")]);
        let ids = search_ids(&db, "xyznonexistent");
        assert!(ids.is_empty(), "query with no matches should return empty");
    }

    #[test]
    fn firestore_ingest_skips_duplicate_id() {
        let db = Db::open(PathBuf::from(":memory:")).unwrap();
        db.create_entry("a", "local", "2025-01-01T12:00:00Z", None)
            .unwrap();
        let n = db
            .ingest_firestore_entries(&[(
                "a".to_string(),
                "remote".to_string(),
                "2025-02-01T12:00:00Z".to_string(),
            )])
            .unwrap();
        assert_eq!(n, 0);
        let row = db.get_entry_by_id("a").unwrap().unwrap();
        assert_eq!(row.text, "local");
    }

    #[test]
    fn firestore_ingest_inserts_new_id() {
        let db = Db::open(PathBuf::from(":memory:")).unwrap();
        let n = db
            .ingest_firestore_entries(&[(
                "x".to_string(),
                "from cloud".to_string(),
                "2025-03-10T08:30:00.000Z".to_string(),
            )])
            .unwrap();
        assert_eq!(n, 1);
        let row = db.get_entry_by_id("x").unwrap().unwrap();
        assert_eq!(row.text, "from cloud");
    }

    #[test]
    fn firestore_ingest_skips_desktop_deleted_id() {
        let db = Db::open(PathBuf::from(":memory:")).unwrap();
        db.create_entry("meow", "cat", "2025-01-01T12:00:00Z", None).unwrap();
        db.delete_entry("meow").unwrap();
        assert!(db.get_entry_by_id("meow").unwrap().is_none());
        let n = db
            .ingest_firestore_entries(&[(
                "meow".to_string(),
                "still in cloud".to_string(),
                "2025-02-01T12:00:00Z".to_string(),
            )])
            .unwrap();
        assert_eq!(n, 0);
        assert!(db.get_entry_by_id("meow").unwrap().is_none());
    }

    #[test]
    fn create_entry_clears_firestore_ingest_suppression() {
        let db = Db::open(PathBuf::from(":memory:")).unwrap();
        db.create_entry("r", "one", "2025-01-01T12:00:00Z", None).unwrap();
        db.delete_entry("r").unwrap();
        db.create_entry("r", "two", "2025-01-02T12:00:00Z", None).unwrap();
        let n = db
            .ingest_firestore_entries(&[(
                "r".to_string(),
                "from cloud".to_string(),
                "2025-03-01T12:00:00Z".to_string(),
            )])
            .unwrap();
        assert_eq!(n, 0);
        let row = db.get_entry_by_id("r").unwrap().unwrap();
        assert_eq!(row.text, "two");
    }

    #[test]
    fn basic_ranking_stronger_match_first() {
        let db = db_with_entries(&[
            ("once", "design review notes"),
            ("twice", "design and design again"),
        ]);
        let rows = db
            .search_entries_filtered("design", &SpaceFilter::All)
            .unwrap();
        assert_eq!(rows.len(), 2);
        let ids: Vec<&str> = rows.iter().map(|r| r.id.as_str()).collect();
        assert_eq!(
            ids[0], "twice",
            "entry with more term matches should rank higher"
        );
        assert_eq!(ids[1], "once");
    }

    #[test]
    fn sync_tombstone_outbox_coalesces_same_entry_id() {
        let db = Db::open(PathBuf::from(":memory:")).unwrap();
        db.enqueue_sync_tombstone("same").unwrap();
        db.enqueue_sync_tombstone("same").unwrap();
        let ids = db.list_sync_tombstone_outbox().unwrap();
        assert_eq!(ids, vec!["same".to_string()]);
    }

    #[test]
    fn delete_local_entries_for_sync_clears_suppression() {
        let db = Db::open(PathBuf::from(":memory:")).unwrap();
        db.create_entry("gone", "x", "2025-01-01T12:00:00Z", None).unwrap();
        db.delete_entry("gone").unwrap();
        assert!(db.get_entry_by_id("gone").unwrap().is_none());
        let n = db
            .ingest_firestore_entries(&[(
                "gone".to_string(),
                "cloud".to_string(),
                "2025-02-01T12:00:00Z".to_string(),
            )])
            .unwrap();
        assert_eq!(n, 0);
        let removed = db
            .delete_local_entries_for_sync(&["gone".to_string()])
            .unwrap();
        assert_eq!(removed, 0);
        let n2 = db
            .ingest_firestore_entries(&[(
                "gone".to_string(),
                "cloud".to_string(),
                "2025-02-01T12:00:00Z".to_string(),
            )])
            .unwrap();
        assert_eq!(n2, 1);
        assert_eq!(
            db.get_entry_by_id("gone").unwrap().unwrap().text,
            "cloud"
        );
    }

    #[test]
    fn jump_anchor_matches_list_entries_local_day() {
        let db = Db::open(PathBuf::from(":memory:")).unwrap();
        db.create_entry("e1", "x", "2025-01-20T18:30:00Z", None).unwrap();
        let created = db.list_entries().unwrap()[0].created_at.clone();
        let utc: chrono::DateTime<chrono::Utc> = chrono::DateTime::parse_from_rfc3339(&created)
            .unwrap()
            .with_timezone(&chrono::Utc);
        let target = utc.with_timezone(&chrono::Local).date_naive();
        assert_eq!(
            db.jump_anchor_entry_id_for_local_date(target, &SpaceFilter::All)
                .unwrap()
                .as_deref(),
            Some("e1")
        );
    }

    #[test]
    fn clear_firestore_ingest_suppression_allows_ingest_like_tombstone_success() {
        let db = Db::open(PathBuf::from(":memory:")).unwrap();
        db.create_entry("t", "local", "2025-01-01T12:00:00Z", None).unwrap();
        db.delete_entry("t").unwrap();
        assert_eq!(
            db.ingest_firestore_entries(&[(
                "t".to_string(),
                "remote".to_string(),
                "2025-03-01T12:00:00Z".to_string(),
            )])
            .unwrap(),
            0
        );
        db.clear_firestore_ingest_suppression("t").unwrap();
        assert_eq!(
            db.ingest_firestore_entries(&[(
                "t".to_string(),
                "remote".to_string(),
                "2025-03-01T12:00:00Z".to_string(),
            )])
            .unwrap(),
            1
        );
    }

    #[test]
    fn remove_sync_tombstone_outbox_is_idempotent() {
        let db = Db::open(PathBuf::from(":memory:")).unwrap();
        db.enqueue_sync_tombstone("z").unwrap();
        db.remove_sync_tombstone_outbox("z").unwrap();
        db.remove_sync_tombstone_outbox("z").unwrap();
        assert!(db.list_sync_tombstone_outbox().unwrap().is_empty());
    }

    #[test]
    fn clear_sync_tombstone_outbox_all_empties_queue() {
        let db = Db::open(PathBuf::from(":memory:")).unwrap();
        db.enqueue_sync_tombstone("a").unwrap();
        db.enqueue_sync_tombstone("b").unwrap();
        db.clear_sync_tombstone_outbox_all().unwrap();
        assert!(db.list_sync_tombstone_outbox().unwrap().is_empty());
    }

    #[test]
    fn share_thread_create_get_revoke() {
        let db = Db::open(PathBuf::from(":memory:")).unwrap();
        db.create_entry("e1", "one", "2025-01-01T12:00:00Z", None)
            .unwrap();
        db.create_entry("e2", "two", "2025-01-02T12:00:00Z", None)
            .unwrap();
        let ids = vec!["e1".to_string(), "e2".to_string()];
        let token = "test-token";
        let created = "2025-01-03T12:00:00Z";
        let expires = "2099-01-01T12:00:00Z";
        db.insert_share_thread(token, &ids, Some("note"), created, expires)
            .unwrap();
        let row = db.get_share_thread_row(token).unwrap().unwrap();
        assert_eq!(row.entry_ids, ids);
        assert_eq!(row.context_note.as_deref(), Some("note"));
        assert!(share_thread_is_active(&row));
        assert!(db.revoke_share_thread(token).unwrap());
        let after = db.get_share_thread_row(token).unwrap().unwrap();
        assert!(!share_thread_is_active(&after));
    }

    #[test]
    fn mark_entry_continuation_sets_marker_once() {
        let db = Db::open(PathBuf::from(":memory:")).unwrap();
        db.create_entry("e1", "original", "2025-01-01T12:00:00Z", None)
            .unwrap();
        db.update_entry_text("e1", "original\ncontinued").unwrap();
        let first = db
            .mark_entry_continuation("e1", 9, "original\ncontinued")
            .unwrap();
        assert!(first.is_some());
        let row = db.get_entry_by_id("e1").unwrap().unwrap();
        assert_eq!(row.continuation_from, Some(9));
        assert!(row.continuation_at.is_some());

        let second = db
            .mark_entry_continuation("e1", 9, "original\ncontinued")
            .unwrap();
        assert_eq!(second, first);
    }

    #[test]
    fn update_entry_text_clears_invalid_continuation_marker() {
        let db = Db::open(PathBuf::from(":memory:")).unwrap();
        db.create_entry("e1", "hello", "2025-01-01T12:00:00Z", None)
            .unwrap();
        db.update_entry_text("e1", "hello\nmore").unwrap();
        db.mark_entry_continuation("e1", 6, "hello\nmore").unwrap();
        db.update_entry_text("e1", "short").unwrap();
        let row = db.get_entry_by_id("e1").unwrap().unwrap();
        assert_eq!(row.continuation_from, None);
        assert_eq!(row.continuation_at, None);
    }

    #[test]
    fn update_entry_text_changes_body_and_increments_edit_count() {
        let db = Db::open(PathBuf::from(":memory:")).unwrap();
        db.create_entry("e1", "original", "2025-01-01T12:00:00Z", None)
            .unwrap();
        let before = db.list_entries().unwrap();
        assert_eq!(before[0].text, "original");
        assert_eq!(before[0].edit_count, 0);

        db.update_entry_text("e1", "revised body").unwrap();
        let after = db.list_entries().unwrap();
        assert_eq!(after[0].text, "revised body");
        assert_eq!(after[0].edit_count, 1);
    }

    #[test]
    fn update_entry_space_changes_lens_without_touching_edit_count() {
        let db = Db::open(PathBuf::from(":memory:")).unwrap();
        db.create_entry("e1", "hello", "2025-01-01T12:00:00Z", None)
            .unwrap();
        assert_eq!(db.list_entries_filtered(&SpaceFilter::Inbox).unwrap().len(), 1);
        assert_eq!(
            db.list_entries_filtered(&SpaceFilter::Space("work".to_string()))
                .unwrap()
                .len(),
            0
        );

        db.update_entry_space("e1", Some("work")).unwrap();
        assert_eq!(db.list_entries_filtered(&SpaceFilter::Inbox).unwrap().len(), 0);
        let work = db
            .list_entries_filtered(&SpaceFilter::Space("work".to_string()))
            .unwrap();
        assert_eq!(work.len(), 1);
        assert_eq!(work[0].space_id.as_deref(), Some("work"));
        assert_eq!(work[0].edit_count, 0);

        db.update_entry_space("e1", None).unwrap();
        assert_eq!(db.list_entries_filtered(&SpaceFilter::Inbox).unwrap().len(), 1);
    }

    #[test]
    fn list_entries_respects_space_filter() {
        let db = Db::open(PathBuf::from(":memory:")).unwrap();
        db.create_entry("a", "inbox text", "2025-01-01T12:00:00Z", None)
            .unwrap();
        db.create_entry(
            "b",
            "work text",
            "2025-01-02T12:00:00Z",
            Some("work"),
        )
        .unwrap();
        assert_eq!(
            db.list_entries_filtered(&SpaceFilter::All).unwrap().len(),
            2
        );
        let inbox = db.list_entries_filtered(&SpaceFilter::Inbox).unwrap();
        assert_eq!(inbox.len(), 1);
        assert_eq!(inbox[0].id, "a");
        let work = db
            .list_entries_filtered(&SpaceFilter::Space("work".to_string()))
            .unwrap();
        assert_eq!(work.len(), 1);
        assert_eq!(work[0].id, "b");
    }

    #[test]
    fn local_entry_dates_in_month_drops_day_after_last_delete() {
        let db = Db::open(PathBuf::from(":memory:")).unwrap();
        db.create_entry("a", "one", "2025-03-24T08:00:00Z", None).unwrap();
        db.create_entry("b", "two", "2025-03-24T18:00:00Z", None).unwrap();

        let initial = db
            .local_entry_dates_in_month(2025, 3, &SpaceFilter::All)
            .unwrap();
        assert!(
            initial.iter().any(|d| d == "2025-03-24"),
            "date with entries should be marked"
        );

        db.delete_entry("a").unwrap();
        let after_first_delete = db
            .local_entry_dates_in_month(2025, 3, &SpaceFilter::All)
            .unwrap();
        assert!(
            after_first_delete.iter().any(|d| d == "2025-03-24"),
            "date should stay marked while at least one entry remains"
        );

        db.delete_entry("b").unwrap();
        let after_last_delete = db
            .local_entry_dates_in_month(2025, 3, &SpaceFilter::All)
            .unwrap();
        assert!(
            !after_last_delete.iter().any(|d| d == "2025-03-24"),
            "date should unmark after last entry is deleted"
        );
    }
}
