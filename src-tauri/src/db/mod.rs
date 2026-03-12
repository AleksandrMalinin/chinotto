mod schema;

use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Db(Mutex<Connection>);

impl Db {
    pub fn open(path: PathBuf) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open(path)?;
        schema::run_migrations(&conn)?;
        Ok(Self(Mutex::new(conn)))
    }

    pub fn create_entry(&self, id: &str, text: &str, created_at: &str) -> Result<(), rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "INSERT INTO entries (id, text, created_at) VALUES (?1, ?2, ?3)",
            [id, text, created_at],
        )?;
        Ok(())
    }

    pub fn list_entries(&self) -> Result<Vec<EntryRow>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, text, created_at FROM entries ORDER BY created_at DESC")?;
        let rows = stmt.query_map([], |r| {
            Ok(EntryRow {
                id: r.get(0)?,
                text: r.get(1)?,
                created_at: r.get(2)?,
            })
        })?;
        rows.collect()
    }

    pub fn search_entries(&self, query: &str) -> Result<Vec<EntryRow>, rusqlite::Error> {
        if query.trim().is_empty() {
            return self.list_entries();
        }
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT e.id, e.text, e.created_at FROM entries e
             INNER JOIN entries_fts f ON e.rowid = f.rowid
             WHERE f MATCH ?1
             ORDER BY e.created_at DESC",
        )?;
        let rows = stmt.query_map([query.trim()], |r| {
            Ok(EntryRow {
                id: r.get(0)?,
                text: r.get(1)?,
                created_at: r.get(2)?,
            })
        })?;
        rows.collect()
    }
}

pub struct EntryRow {
    pub id: String,
    pub text: String,
    pub created_at: String,
}
