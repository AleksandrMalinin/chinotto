mod db;

use db::Db;
use std::fs;
use tauri::Manager;

#[tauri::command]
fn create_entry(db: tauri::State<Db>, text: String) -> Result<(), String> {
    let id = uuid::Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().to_rfc3339();
    db.create_entry(&id, &text, &created_at).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_entries(db: tauri::State<Db>) -> Result<Vec<EntryPayload>, String> {
    let rows = db.list_entries().map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|r| EntryPayload {
            id: r.id,
            text: r.text,
            created_at: r.created_at,
        })
        .collect())
}

#[tauri::command]
fn search_entries(db: tauri::State<Db>, query: String) -> Result<Vec<EntryPayload>, String> {
    let rows = db.search_entries(&query).map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|r| EntryPayload {
            id: r.id,
            text: r.text,
            created_at: r.created_at,
        })
        .collect())
}

#[derive(serde::Serialize)]
struct EntryPayload {
    id: String,
    text: String,
    created_at: String,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            let path = app
                .handle()
                .path()
                .app_data_dir()
                .map_err(|e| e.to_string())?;
            fs::create_dir_all(&path).map_err(|e| e.to_string())?;
            let db_path = path.join("chinotto.db");
            let db = Db::open(db_path).map_err(|e| e.to_string())?;
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![create_entry, list_entries, search_entries])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
