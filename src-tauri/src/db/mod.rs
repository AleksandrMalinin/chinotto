mod schema;

use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

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
    conn.execute("ALTER TABLE entries ADD COLUMN edit_count INTEGER DEFAULT 0", [])?;
    conn.execute("ALTER TABLE entries ADD COLUMN open_count INTEGER DEFAULT 0", [])?;
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
            let placeholders = exclude_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
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
        let mut stmt = conn.prepare(
            "SELECT e.id, e.text, e.created_at,
                    highlight(entries_fts, 0, '\u{0001}', '\u{0002}') AS highlighted
             FROM entries e
             INNER JOIN entries_fts ON e.rowid = entries_fts.rowid
             WHERE entries_fts MATCH ?1
             ORDER BY e.created_at DESC",
        )?;
        let rows = stmt.query_map([query.trim()], |r| {
            let highlighted: String = r.get(3)?;
            Ok(SearchEntryRow {
                id: r.get(0)?,
                text: r.get(1)?,
                created_at: r.get(2)?,
                highlighted: Some(highlighted),
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
