mod schema;

use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

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

impl Db {
    pub fn open(path: PathBuf) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open(path)?;
        schema::run_migrations(&conn)?;
        ensure_importance_columns(&conn)?;
        Ok(Self(Mutex::new(conn)))
    }

    pub fn create_entry(
        &self,
        id: &str,
        text: &str,
        created_at: &str,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "INSERT INTO entries (id, text, created_at) VALUES (?1, ?2, ?3)",
            [id, text, created_at],
        )?;
        Ok(())
    }

    pub fn update_entry_text(&self, id: &str, text: &str) -> Result<(), rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "UPDATE entries SET text = ?1, edit_count = COALESCE(edit_count, 0) + 1 WHERE id = ?2",
            [text, id],
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
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, text, created_at, COALESCE(edit_count, 0), COALESCE(open_count, 0) FROM entries ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok(EntryRow {
                id: r.get(0)?,
                text: r.get(1)?,
                created_at: r.get(2)?,
                edit_count: r.get::<_, i64>(3)? as u32,
                open_count: r.get::<_, i64>(4)? as u32,
            })
        })?;
        rows.collect()
    }

    pub fn get_entry_by_id(&self, id: &str) -> Result<Option<EntryRow>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, text, created_at, COALESCE(edit_count, 0), COALESCE(open_count, 0) FROM entries WHERE id = ?1",
        )?;
        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            return Ok(Some(EntryRow {
                id: row.get(0)?,
                text: row.get(1)?,
                created_at: row.get(2)?,
                edit_count: row.get::<_, i64>(3)? as u32,
                open_count: row.get::<_, i64>(4)? as u32,
            }));
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

    pub fn get_entries_with_embeddings_older_than(
        &self,
        cutoff_iso: &str,
    ) -> Result<Vec<EntryRow>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT e.id, e.text, e.created_at, COALESCE(e.edit_count, 0), COALESCE(e.open_count, 0)
             FROM entries e
             INNER JOIN entry_embeddings em ON e.id = em.entry_id
             WHERE e.created_at < ?1
             ORDER BY e.created_at ASC",
        )?;
        let rows = stmt.query_map([cutoff_iso], |r| {
            Ok(EntryRow {
                id: r.get(0)?,
                text: r.get(1)?,
                created_at: r.get(2)?,
                edit_count: r.get::<_, i64>(3)? as u32,
                open_count: r.get::<_, i64>(4)? as u32,
            })
        })?;
        rows.collect()
    }

    pub fn get_recent_entries_with_embeddings(
        &self,
        limit: usize,
    ) -> Result<Vec<EntryRow>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT e.id, e.text, e.created_at, COALESCE(e.edit_count, 0), COALESCE(e.open_count, 0)
             FROM entries e
             INNER JOIN entry_embeddings em ON e.id = em.entry_id
             ORDER BY e.created_at DESC
             LIMIT ?1",
        )?;
        let rows = stmt.query_map([limit as i64], |r| {
            Ok(EntryRow {
                id: r.get(0)?,
                text: r.get(1)?,
                created_at: r.get(2)?,
                edit_count: r.get::<_, i64>(3)? as u32,
                open_count: r.get::<_, i64>(4)? as u32,
            })
        })?;
        rows.collect()
    }

    /// Entries whose created_at is in [from_iso, to_iso], excluding given ids.
    /// ISO 8601 strings compare lexicographically.
    pub fn get_entries_in_time_window(
        &self,
        from_iso: &str,
        to_iso: &str,
        exclude_ids: &[String],
    ) -> Result<Vec<EntryRow>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let mut sql = String::from(
            "SELECT id, text, created_at, COALESCE(edit_count, 0), COALESCE(open_count, 0) FROM entries WHERE created_at >= ?1 AND created_at <= ?2",
        );
        if !exclude_ids.is_empty() {
            let placeholders = exclude_ids
                .iter()
                .map(|_| "?")
                .collect::<Vec<_>>()
                .join(",");
            sql.push_str(" AND id NOT IN (");
            sql.push_str(&placeholders);
            sql.push_str(")");
        }
        sql.push_str(" ORDER BY created_at DESC");
        let mut stmt = conn.prepare(&sql)?;
        let mut rows = if exclude_ids.is_empty() {
            stmt.query([from_iso, to_iso])?
        } else {
            let mut str_refs: Vec<&str> = vec![from_iso, to_iso];
            for id in exclude_ids {
                str_refs.push(id);
            }
            let mut params: Vec<&dyn rusqlite::ToSql> = Vec::new();
            for s in &str_refs {
                params.push(&*s);
            }
            stmt.query(rusqlite::params_from_iter(params))?
        };
        let mut out = vec![];
        while let Some(row) = rows.next()? {
            out.push(EntryRow {
                id: row.get(0)?,
                text: row.get(1)?,
                created_at: row.get(2)?,
                edit_count: row.get::<_, i64>(3)? as u32,
                open_count: row.get::<_, i64>(4)? as u32,
            });
        }
        Ok(out)
    }

    pub fn get_entries_by_ids(&self, ids: &[String]) -> Result<Vec<EntryRow>, rusqlite::Error> {
        if ids.is_empty() {
            return Ok(vec![]);
        }
        let conn = self.0.lock().unwrap();
        let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT id, text, created_at, COALESCE(edit_count, 0), COALESCE(open_count, 0) FROM entries WHERE id IN ({})",
            placeholders
        );
        let mut stmt = conn.prepare(&sql)?;
        let mut rows = stmt.query(rusqlite::params_from_iter(ids.iter()))?;
        let mut out = vec![];
        while let Some(row) = rows.next()? {
            out.push(EntryRow {
                id: row.get(0)?,
                text: row.get(1)?,
                created_at: row.get(2)?,
                edit_count: row.get::<_, i64>(3)? as u32,
                open_count: row.get::<_, i64>(4)? as u32,
            });
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
        Ok(())
    }

    /// Remove every entry and related rows (pins, embeddings). For local debug tooling.
    pub fn delete_all_entries(&self) -> Result<(), rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        conn.execute("DELETE FROM pinned_entries", [])?;
        conn.execute("DELETE FROM entry_embeddings", [])?;
        conn.execute("DELETE FROM entries", [])?;
        Ok(())
    }

    pub fn search_entries(&self, query: &str) -> Result<Vec<SearchEntryRow>, rusqlite::Error> {
        if query.trim().is_empty() {
            let rows = self.list_entries()?;
            return Ok(rows
                .into_iter()
                .map(|r| SearchEntryRow {
                    id: r.id,
                    text: r.text,
                    created_at: r.created_at,
                    highlighted: None,
                })
                .collect());
        }
        let conn = self.0.lock().unwrap();
        let prefix_query = fts5_prefix_query(query);

        if !prefix_query.is_empty() {
            let sql = "SELECT e.id, e.text, e.created_at,
                    highlight(entries_fts, 0, '\u{0001}', '\u{0002}') AS highlighted
             FROM entries e
             INNER JOIN entries_fts ON e.rowid = entries_fts.rowid
             WHERE entries_fts MATCH ?1
             ORDER BY bm25(entries_fts)";
            if let Ok(mut stmt) = conn.prepare(sql) {
                let rows = stmt.query_map([&prefix_query], |r| {
                    let highlighted: String = r.get(3)?;
                    Ok(SearchEntryRow {
                        id: r.get(0)?,
                        text: r.get(1)?,
                        created_at: r.get(2)?,
                        highlighted: Some(highlighted),
                    })
                });
                if let Ok(rows) = rows {
                    if let Ok(list) = rows.collect::<Result<Vec<_>, _>>() {
                        if !list.is_empty() {
                            return Ok(list);
                        }
                    }
                }
            }
        }

        let query_trim = query.trim();
        let like_pattern = format!("%{}%", escape_like(query_trim));
        let fallback_sql = "SELECT id, text, created_at FROM entries WHERE LOWER(text) LIKE LOWER(?1) ESCAPE '\\' ORDER BY created_at DESC";
        let mut stmt = conn.prepare(fallback_sql)?;
        let rows = stmt.query_map([&like_pattern], |r| {
            let id: String = r.get(0)?;
            let text: String = r.get(1)?;
            let created_at: String = r.get(2)?;
            let highlighted = Some(highlight_substring(&text, query_trim));
            Ok(SearchEntryRow {
                id,
                text,
                created_at,
                highlighted,
            })
        })?;
        rows.collect()
    }
}

#[derive(Clone)]
pub struct EntryRow {
    pub id: String,
    pub text: String,
    pub created_at: String,
    pub edit_count: u32,
    pub open_count: u32,
}

pub struct SearchEntryRow {
    pub id: String,
    pub text: String,
    pub created_at: String,
    pub highlighted: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn db_with_entries(entries: &[(&str, &str)]) -> Db {
        let db = Db::open(PathBuf::from(":memory:")).unwrap();
        for (i, (id, text)) in entries.iter().enumerate() {
            let created = format!("2025-01-{:02}T12:00:00Z", 15 - i);
            db.create_entry(id, text, &created).unwrap();
        }
        db
    }

    fn search_ids(db: &Db, query: &str) -> Vec<String> {
        db.search_entries(query)
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
    fn basic_ranking_stronger_match_first() {
        let db = db_with_entries(&[
            ("once", "design review notes"),
            ("twice", "design and design again"),
        ]);
        let rows = db.search_entries("design").unwrap();
        assert_eq!(rows.len(), 2);
        let ids: Vec<&str> = rows.iter().map(|r| r.id.as_str()).collect();
        assert_eq!(
            ids[0], "twice",
            "entry with more term matches should rank higher"
        );
        assert_eq!(ids[1], "once");
    }
}
