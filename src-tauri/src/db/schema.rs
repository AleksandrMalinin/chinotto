use rusqlite::Connection;

pub fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    let sql = include_str!("schema.sql");
    conn.execute_batch(sql)?;
    Ok(())
}
