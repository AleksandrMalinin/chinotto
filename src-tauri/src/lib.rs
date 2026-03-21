mod db;
mod embeddings;
mod keywords;
mod recall;
mod thought_trail;

#[cfg(target_os = "macos")]
mod speech;

use base64::Engine;
use chrono::TimeZone;
use db::Db;
use keywords::{
    extract_keywords, keyword_overlap, thought_trail_candidates, thought_trail_max_related,
    thought_trail_min_overlap, thought_trail_similarity,
};
use std::fs;
use std::fs::File;
use std::io::Write;
use std::path::PathBuf;
use std::sync::mpsc;
use std::sync::Arc;
use tauri::Emitter;
use tauri::Manager;

fn parse_created_at(iso: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    chrono::DateTime::parse_from_rfc3339(iso)
        .ok()
        .map(|dt| dt.with_timezone(&chrono::Utc))
}

fn format_ago(
    created: chrono::DateTime<chrono::Utc>,
    now: chrono::DateTime<chrono::Utc>,
) -> String {
    let d = (now - created).num_days();
    if d >= 365 {
        let y = d / 365;
        format!("{} year{} ago", y, if y == 1 { "" } else { "s" })
    } else if d >= 30 {
        let m = d / 30;
        format!("{} month{} ago", m, if m == 1 { "" } else { "s" })
    } else if d >= 7 {
        let w = d / 7;
        format!("{} week{} ago", w, if w == 1 { "" } else { "s" })
    } else if d >= 1 {
        format!("{} day{} ago", d, if d == 1 { "" } else { "s" })
    } else {
        "today".to_string()
    }
}

/// Memory-style reason for temporal recall (24h / 7d / 30d anchors).
fn temporal_reason_anchor(anchor: &str) -> &'static str {
    match anchor {
        "24h" => "You wrote this yesterday",
        "7d" => "You wrote this last week",
        "30d" => "You wrote this a month ago",
        _ => "You wrote this before",
    }
}

/// Simple importance score from existing signals: pinned, edited, opened.
/// Used only as a small ranking boost in recall (resurface, thought trail).
/// Formula: pin_weight (1 if pinned) + edit_weight (capped) + open_weight (capped).
const IMPORTANCE_PIN: f64 = 1.0;
const IMPORTANCE_EDIT_FACTOR: f64 = 0.5;
const IMPORTANCE_EDIT_CAP: f64 = 2.0;
const IMPORTANCE_OPEN_FACTOR: f64 = 0.2;
const IMPORTANCE_OPEN_CAP: f64 = 1.5;

fn importance_score(entry: &db::EntryRow, pinned_ids: &std::collections::HashSet<String>) -> f64 {
    let pin = if pinned_ids.contains(&entry.id) {
        IMPORTANCE_PIN
    } else {
        0.0
    };
    let edit = (entry.edit_count as f64 * IMPORTANCE_EDIT_FACTOR).min(IMPORTANCE_EDIT_CAP);
    let open = (entry.open_count as f64 * IMPORTANCE_OPEN_FACTOR).min(IMPORTANCE_OPEN_CAP);
    pin + edit + open
}

/// Boost factor for recall ranking: 1.0 + small weight * importance (max ~1.2).
const IMPORTANCE_BOOST_WEIGHT: f64 = 0.08;

fn importance_boost(importance: f64) -> f64 {
    1.0 + IMPORTANCE_BOOST_WEIGHT * importance
}

#[tauri::command]
fn create_entry(db: tauri::State<Db>, text: String) -> Result<String, String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err("entry text cannot be empty".to_string());
    }
    let id = uuid::Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().to_rfc3339();
    db.create_entry(&id, trimmed, &created_at)
        .map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn restore_entry(
    db: tauri::State<Db>,
    id: String,
    text: String,
    created_at: String,
) -> Result<String, String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err("entry text cannot be empty".to_string());
    }
    match db.create_entry(&id, trimmed, &created_at) {
        Ok(()) => Ok(id),
        Err(e) => {
            if e.to_string().contains("UNIQUE constraint") {
                let new_id = uuid::Uuid::new_v4().to_string();
                db.create_entry(&new_id, trimmed, &created_at)
                    .map_err(|e| e.to_string())?;
                Ok(new_id)
            } else {
                Err(e.to_string())
            }
        }
    }
}

#[tauri::command]
fn generate_embedding(db: tauri::State<Db>, entry_id: String) -> Result<(), String> {
    let entry = db
        .get_entry_by_id(&entry_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "entry not found")?;
    let vec = embeddings::embed_text(&entry.text).map_err(|e| e.to_string())?;
    db.insert_embedding(&entry_id, &vec)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Minimum cosine similarity for an entry to appear in "Related entries".
/// Without this, the top-N by score included weak matches (e.g. entry about Tauri → movie title).
/// Embedding similarity has no cutoff, so unrelated text can still score 0.2–0.4; we require ~0.5+.
const MIN_RELATED_SIMILARITY: f32 = 0.5;

/// Filter (id, similarity) pairs by min_sim, sort by score descending, take top `limit` ids.
/// Used by find_similar_entries so threshold is applied before sort/limit; testable in isolation.
fn top_related_ids(mut with_sim: Vec<(String, f32)>, min_sim: f32, limit: usize) -> Vec<String> {
    with_sim.retain(|(_, s)| *s >= min_sim);
    with_sim.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    with_sim.into_iter().take(limit).map(|(id, _)| id).collect()
}

#[tauri::command]
fn find_similar_entries(
    db: tauri::State<Db>,
    entry_id: String,
    limit: u32,
) -> Result<Vec<EntryPayload>, String> {
    let query_embedding = match db.get_embedding(&entry_id).map_err(|e| e.to_string())? {
        Some(v) => v,
        None => return Ok(vec![]),
    };
    let others = db
        .get_all_embeddings_excluding(&entry_id)
        .map_err(|e| e.to_string())?;
    let limit = limit.min(50) as usize;
    let with_sim: Vec<(String, f32)> = others
        .into_iter()
        .map(|(id, emb)| {
            let sim = embeddings::cosine_similarity(&query_embedding, &emb);
            (id, sim)
        })
        .collect();
    let top_ids = top_related_ids(with_sim, MIN_RELATED_SIMILARITY, limit);
    let rows = db.get_entries_by_ids(&top_ids).map_err(|e| e.to_string())?;
    let by_id: std::collections::HashMap<String, db::EntryRow> =
        rows.into_iter().map(|r| (r.id.clone(), r)).collect();
    let limit = keywords::default_topic_limit();
    let out: Vec<EntryPayload> = top_ids
        .into_iter()
        .filter_map(|id| by_id.get(&id))
        .map(|r| {
            let topics = extract_keywords(&r.text, limit);
            EntryPayload {
                id: r.id.clone(),
                text: r.text.clone(),
                created_at: r.created_at.clone(),
                topics: if topics.is_empty() {
                    None
                } else {
                    Some(topics)
                },
            }
        })
        .collect();
    Ok(out)
}

#[tauri::command]
fn list_entries(db: tauri::State<Db>) -> Result<Vec<EntryPayload>, String> {
    let rows = db.list_entries().map_err(|e| e.to_string())?;
    let limit = keywords::default_topic_limit();
    Ok(rows
        .into_iter()
        .map(|r| {
            let topics = extract_keywords(&r.text, limit);
            EntryPayload {
                id: r.id,
                text: r.text,
                created_at: r.created_at,
                topics: if topics.is_empty() {
                    None
                } else {
                    Some(topics)
                },
            }
        })
        .collect())
}

/// Temporal recall: try 24h, 7d, 30d anchors (±3h window); fallback to random past entry.
/// Delegates to recall::select_entry_for_resurface (pure, testable).
#[tauri::command]
fn get_resurfaced_entry(
    db: tauri::State<Db>,
    exclude_ids: Vec<String>,
) -> Result<Option<ResurfacedPayload>, String> {
    get_resurfaced_entry_impl(&*db, exclude_ids, &mut rand::thread_rng())
}

/// Core resurface logic (DB + exclude list + RNG). Used by the command and by integration tests.
pub(crate) fn get_resurfaced_entry_impl<R: rand::RngCore>(
    db: &Db,
    exclude_ids: Vec<String>,
    rng: &mut R,
) -> Result<Option<ResurfacedPayload>, String> {
    let all = db.list_entries().map_err(|e| e.to_string())?;
    let entries: Vec<recall::ResurfaceEntry> = all
        .into_iter()
        .map(|r| recall::ResurfaceEntry {
            id: r.id,
            text: r.text,
            created_at: r.created_at,
            edit_count: r.edit_count,
            open_count: r.open_count,
        })
        .collect();
    let pinned_ids: std::collections::HashSet<String> = db
        .list_pinned_entry_ids()
        .map_err(|e| e.to_string())?
        .into_iter()
        .collect();
    let exclude: std::collections::HashSet<&str> = exclude_ids.iter().map(String::as_str).collect();
    let pinned_ref: std::collections::HashSet<&str> =
        pinned_ids.iter().map(String::as_str).collect();
    let now = chrono::Utc::now();
    let result = recall::select_entry_for_resurface(&entries, now, &exclude, &pinned_ref, rng);
    let (picked, anchor) = match result {
        Some(r) => r,
        None => return Ok(None),
    };
    let reason = match anchor {
        recall::Anchor::Anchor24h => temporal_reason_anchor("24h").to_string(),
        recall::Anchor::Anchor7d => temporal_reason_anchor("7d").to_string(),
        recall::Anchor::Anchor30d => temporal_reason_anchor("30d").to_string(),
        recall::Anchor::Fallback => {
            let created = parse_created_at(&picked.created_at).unwrap_or(now);
            format!("You wrote this {}.", format_ago(created, now))
        }
    };
    let topics = extract_keywords(&picked.text, keywords::default_topic_limit());
    Ok(Some(ResurfacedPayload {
        entry: EntryPayload {
            id: picked.id,
            text: picked.text,
            created_at: picked.created_at,
            topics: if topics.is_empty() {
                None
            } else {
                Some(topics)
            },
        },
        reason,
    }))
}

/// Thought trail: related entries ordered as earlier → current → later.
/// Scores by similarity (IDF-weighted keyword overlap) + temporal proximity; importance is a small boost.
#[tauri::command]
fn get_thought_trail(db: tauri::State<Db>, entry_id: String) -> Result<Vec<EntryPayload>, String> {
    let current = db
        .get_entry_by_id(&entry_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "entry not found".to_string())?;
    let current_ts = parse_created_at(&current.created_at).unwrap_or_else(chrono::Utc::now);
    let pinned_ids: std::collections::HashSet<String> = db
        .list_pinned_entry_ids()
        .map_err(|e| e.to_string())?
        .into_iter()
        .collect();
    let all = db.list_entries().map_err(|e| e.to_string())?;
    let candidates: Vec<db::EntryRow> = all
        .into_iter()
        .filter(|r| r.id != entry_id)
        .take(thought_trail_candidates())
        .collect();
    let corpus: Vec<std::collections::HashSet<String>> = candidates
        .iter()
        .map(|r| keywords::token_set(&r.text))
        .collect();
    let min_overlap = thought_trail_min_overlap();
    let max_related = thought_trail_max_related();
    let half = max_related / 2;

    let mut scored: Vec<(db::EntryRow, f64)> = candidates
        .into_iter()
        .filter(|r| keyword_overlap(&current.text, &r.text) >= min_overlap)
        .map(|r| {
            let sim = thought_trail_similarity(&current.text, &r.text, &corpus, 15);
            let other_ts = parse_created_at(&r.created_at).unwrap_or(current_ts);
            let days = (current_ts - other_ts).num_days().unsigned_abs() as f64;
            let time_score = 1.0 / (1.0 + days);
            let base = 0.6 * sim + 0.4 * time_score;
            let score = base * importance_boost(importance_score(&r, &pinned_ids));
            (r, score)
        })
        .collect();
    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let (before, after): (Vec<_>, Vec<_>) = scored
        .into_iter()
        .map(|(row, score)| (row, score))
        .partition(|(r, _)| {
            parse_created_at(&r.created_at)
                .map(|t| t < current_ts)
                .unwrap_or(false)
        });

    let take_before: Vec<db::EntryRow> = before.into_iter().take(half).map(|(r, _)| r).collect();
    let take_after: Vec<db::EntryRow> = after.into_iter().take(half).map(|(r, _)| r).collect();

    let mut before_sorted = take_before;
    before_sorted.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    let mut after_sorted = take_after;
    after_sorted.sort_by(|a, b| a.created_at.cmp(&b.created_at));

    let limit = keywords::default_topic_limit();
    let to_payload = |r: &db::EntryRow| {
        let topics = extract_keywords(&r.text, limit);
        EntryPayload {
            id: r.id.clone(),
            text: r.text.clone(),
            created_at: r.created_at.clone(),
            topics: if topics.is_empty() {
                None
            } else {
                Some(topics)
            },
        }
    };
    let mut out: Vec<EntryPayload> = before_sorted.iter().map(to_payload).collect();
    out.push(EntryPayload {
        id: current.id.clone(),
        text: current.text.clone(),
        created_at: current.created_at.clone(),
        topics: {
            let t = extract_keywords(&current.text, limit);
            if t.is_empty() {
                None
            } else {
                Some(t)
            }
        },
    });
    out.extend(after_sorted.iter().map(to_payload));
    Ok(out)
}

#[tauri::command]
fn search_entries(db: tauri::State<Db>, query: String) -> Result<Vec<SearchEntryPayload>, String> {
    let rows = db.search_entries(&query).map_err(|e| e.to_string())?;
    let limit = keywords::default_topic_limit();
    Ok(rows
        .into_iter()
        .map(|r| {
            let topics = extract_keywords(&r.text, limit);
            SearchEntryPayload {
                id: r.id,
                text: r.text,
                created_at: r.created_at,
                highlighted: r.highlighted,
                topics: if topics.is_empty() {
                    None
                } else {
                    Some(topics)
                },
            }
        })
        .collect())
}

#[tauri::command]
fn pin_entry(db: tauri::State<Db>, entry_id: String) -> Result<(), String> {
    db.get_entry_by_id(&entry_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "entry not found".to_string())?;
    db.insert_pinned(&entry_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn unpin_entry(db: tauri::State<Db>, entry_id: String) -> Result<(), String> {
    db.remove_pinned(&entry_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_pinned_entry_ids(db: tauri::State<Db>) -> Result<Vec<String>, String> {
    db.list_pinned_entry_ids().map_err(|e| e.to_string())
}

#[tauri::command]
fn update_entry(db: tauri::State<Db>, entry_id: String, text: String) -> Result<(), String> {
    db.get_entry_by_id(&entry_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "entry not found".to_string())?;
    db.update_entry_text(&entry_id, &text)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn record_entry_open(db: tauri::State<Db>, entry_id: String) -> Result<(), String> {
    db.record_entry_open(&entry_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_entry(db: tauri::State<Db>, entry_id: String) -> Result<(), String> {
    db.get_entry_by_id(&entry_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "entry not found".to_string())?;
    db.delete_entry(&entry_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_all_entries(db: tauri::State<Db>) -> Result<(), String> {
    db.delete_all_entries().map_err(|e| e.to_string())
}

#[tauri::command]
fn export_entries(db: tauri::State<Db>, path: String) -> Result<(), String> {
    let mut rows = db.list_entries().map_err(|e| e.to_string())?;
    rows.reverse();
    let dest = PathBuf::from(&path);
    let file = File::create(&dest).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let opts =
        zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
    for row in rows {
        let dt = parse_created_at(&row.created_at)
            .ok_or_else(|| format!("invalid created_at: {}", row.created_at))?;
        let filename = format!("{}.md", dt.format("%Y-%m-%d-%H-%M-%S"));
        let frontmatter = format!(
            "---\ncreated_at: {}\napp: chinotto\nversion: {}\n---\n\n",
            row.created_at,
            env!("CARGO_PKG_VERSION")
        );
        let content = format!("{}{}", frontmatter, row.text);
        let entry_path = format!("chinotto-export/entries/{}", filename);
        zip.start_file(entry_path, opts)
            .map_err(|e| e.to_string())?;
        zip.write_all(content.as_bytes())
            .map_err(|e| e.to_string())?;
    }
    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}

const BACKUP_RETENTION_COUNT: usize = 7;
const AUTO_BACKUP_COOLDOWN_HOURS: i64 = 24;

fn backup_paths(app: &tauri::AppHandle) -> Result<(PathBuf, PathBuf), String> {
    let base = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = base.join("chinotto.db");
    let backups_dir = base.join("chinotto-backups");
    Ok((db_path, backups_dir))
}

fn prune_old_backups(backups_dir: &std::path::Path) -> Result<(), String> {
    let mut entries: Vec<(std::time::SystemTime, PathBuf)> = Vec::new();
    for e in fs::read_dir(backups_dir).map_err(|e| e.to_string())? {
        let e = e.map_err(|e| e.to_string())?;
        let path = e.path();
        if path.extension().map_or(false, |e| e == "db") {
            if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                if let Some(suffix) = stem.strip_prefix("chinotto-") {
                    if chrono::NaiveDateTime::parse_from_str(suffix, "%Y-%m-%d-%H-%M").is_ok() {
                        if let Ok(meta) = e.metadata() {
                            if let Ok(modified) = meta.modified() {
                                entries.push((modified, path));
                            }
                        }
                    }
                }
            }
        }
    }
    if entries.len() <= BACKUP_RETENTION_COUNT {
        return Ok(());
    }
    entries.sort_by(|a, b| b.0.cmp(&a.0));
    for (_, path) in entries.into_iter().skip(BACKUP_RETENTION_COUNT) {
        let _ = fs::remove_file(&path);
    }
    Ok(())
}

#[tauri::command]
fn create_backup(app: tauri::AppHandle) -> Result<(), String> {
    let (db_path, backups_dir) = backup_paths(&app)?;
    if !db_path.exists() {
        return Err("Database file not found.".to_string());
    }
    fs::create_dir_all(&backups_dir).map_err(|e| e.to_string())?;
    let timestamp = chrono::Utc::now().format("%Y-%m-%d-%H-%M");
    let backup_name = format!("chinotto-{}.db", timestamp);
    let backup_path = backups_dir.join(&backup_name);
    fs::copy(&db_path, &backup_path).map_err(|e| e.to_string())?;
    prune_old_backups(&backups_dir)?;
    Ok(())
}

#[tauri::command]
fn create_backup_if_needed(app: tauri::AppHandle) -> Result<(), String> {
    let (db_path, backups_dir) = backup_paths(&app)?;
    if !db_path.exists() {
        return Ok(());
    }
    if !backups_dir.exists() {
        return create_backup(app);
    }
    let mut latest: Option<chrono::DateTime<chrono::Utc>> = None;
    for e in fs::read_dir(&backups_dir).map_err(|e| e.to_string())? {
        let e = e.map_err(|e| e.to_string())?;
        let path = e.path();
        if path.extension().map_or(false, |e| e == "db") {
            if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                if let Some(suffix) = stem.strip_prefix("chinotto-") {
                    if let Ok(naive) =
                        chrono::NaiveDateTime::parse_from_str(suffix, "%Y-%m-%d-%H-%M")
                    {
                        let dt = chrono::Utc.from_utc_datetime(&naive);
                        if latest.map_or(true, |l| dt > l) {
                            latest = Some(dt);
                        }
                    }
                }
            }
        }
    }
    let need = match latest {
        None => true,
        Some(l) => {
            chrono::Utc::now().signed_duration_since(l).num_hours() >= AUTO_BACKUP_COOLDOWN_HOURS
        }
    };
    if need {
        create_backup(app)
    } else {
        Ok(())
    }
}

#[derive(serde::Serialize)]
struct EntryPayload {
    id: String,
    text: String,
    created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    topics: Option<Vec<String>>,
}

#[derive(serde::Serialize)]
struct SearchEntryPayload {
    id: String,
    text: String,
    created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    highlighted: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    topics: Option<Vec<String>>,
}

#[derive(serde::Serialize)]
struct ResurfacedPayload {
    entry: EntryPayload,
    reason: String,
}

#[cfg(target_os = "macos")]
struct SpeechCommandTx(Arc<mpsc::SyncSender<speech::SpeechCommand>>);

#[tauri::command]
fn run_native_speech_recognition(
    app: tauri::AppHandle,
    max_ms: Option<u64>,
) -> Result<Option<String>, String> {
    #[cfg(target_os = "macos")]
    {
        if !EXPERIMENTAL_VOICE_CAPTURE {
            return Err("Voice capture is not enabled".to_string());
        }
        eprintln!("[Speech] hotkey triggered / command invoked");
        let max_ms = max_ms.unwrap_or(10_000);
        let (result_tx, result_rx) = mpsc::sync_channel(1);
        let (event_tx, event_rx) = mpsc::sync_channel(4);
        let app_handle = app.clone();
        std::thread::spawn(move || {
            while let Ok(state) = event_rx.recv() {
                let _ = app_handle.emit("chinotto-speech-state", state);
            }
        });
        let cmd_tx = app.state::<SpeechCommandTx>().0.clone();
        cmd_tx
            .send((max_ms, result_tx, Some(event_tx)))
            .map_err(|_| "Speech channel closed".to_string())?;
        match result_rx.recv_timeout(std::time::Duration::from_secs(60)) {
            Ok(inner) => inner,
            Err(_) => Err("Speech recognition timed out".to_string()),
        }
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (app, max_ms);
    #[cfg(not(target_os = "macos"))]
    Err("Native speech recognition is only available on macOS".to_string())
}

#[tauri::command]
fn set_app_icon(_app: tauri::AppHandle, png_base64: String) -> Result<(), String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(png_base64.trim())
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    set_macos_dock_icon(&bytes)?;
    #[cfg(not(target_os = "macos"))]
    {
        let window = app
            .get_webview_window("main")
            .ok_or("main window not found")?;
        window
            .set_icon(tauri::Icon::Raw(bytes))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn set_macos_dock_icon(png_bytes: &[u8]) -> Result<(), String> {
    use objc2::rc::Allocated;
    use objc2::{msg_send, ClassType, MainThreadMarker};
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::{NSData, NSSize};

    unsafe {
        let mtm = MainThreadMarker::new().ok_or("Not on main thread")?;
        let app = NSApplication::sharedApplication(mtm);
        let data = NSData::with_bytes(png_bytes);
        let alloc: Allocated<NSImage> = msg_send![NSImage::class(), alloc];
        let image = NSImage::initWithData(alloc, &data).ok_or("NSImage initWithData failed")?;
        // PNG is 1024×1024 px. Without setSize, AppKit maps ~1 px = 1 pt (Dock tile too large).
        // 512×512 pt is the logical size for a 1024 px @2x app icon (matches bundle safe-area artwork).
        const DOCK_ICON_LOGICAL_PTS: f64 = 512.0;
        image.setSize(NSSize::new(DOCK_ICON_LOGICAL_PTS, DOCK_ICON_LOGICAL_PTS));
        app.setApplicationIconImage(Some(&image));
    }
    Ok(())
}

/// Voice capture is disabled in the main flow. Set to true to re-enable as an experimental feature.
const EXPERIMENTAL_VOICE_CAPTURE: bool = false;

const VOICE_SHORTCUT: &str = "CommandOrControl+Shift+V";
const VOICE_HOLD: &str = "Alt+Space";
const CAPTURE_SHORTCUT: &str = "CommandOrControl+Shift+K";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use std::str::FromStr;
    use tauri::Emitter;
    use tauri::Manager;
    use tauri_plugin_global_shortcut::{Shortcut, ShortcutState};

    let voice_shortcut_id = Shortcut::from_str(VOICE_SHORTCUT).ok().map(|s| s.id());
    let voice_hold_id = Shortcut::from_str(VOICE_HOLD).ok().map(|s| s.id());
    let capture_shortcut_id = Shortcut::from_str(CAPTURE_SHORTCUT).ok().map(|s| s.id());

    let voice_handler =
        move |app: &tauri::AppHandle,
              shortcut: &tauri_plugin_global_shortcut::Shortcut,
              event: tauri_plugin_global_shortcut::ShortcutEvent| {
            let id = shortcut.id();
            let _ = match (voice_shortcut_id, voice_hold_id, &event.state) {
                (Some(sid), _, ShortcutState::Pressed) if id == sid => {
                    app.emit("chinotto-voice-shortcut", ())
                }
                (_, Some(hid), ShortcutState::Pressed) if id == hid => {
                    app.emit("chinotto-voice-hold-start", ())
                }
                (_, Some(hid), ShortcutState::Released) if id == hid => {
                    app.emit("chinotto-voice-hold-stop", ())
                }
                _ => Ok(()),
            };

            if matches!(event.state, ShortcutState::Pressed) && Some(id) == capture_shortcut_id {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
                let _ = app.emit("chinotto-capture-shortcut", ());
            }
        };

    let mut shortcuts: Vec<&str> = vec![CAPTURE_SHORTCUT];
    if EXPERIMENTAL_VOICE_CAPTURE {
        shortcuts.push(VOICE_SHORTCUT);
        shortcuts.push(VOICE_HOLD);
    }
    let plugin_builder = tauri_plugin_global_shortcut::Builder::new()
        .with_shortcuts(shortcuts)
        .expect("shortcuts")
        .with_handler(voice_handler)
        .build();

    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(plugin_builder)
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
            #[cfg(target_os = "macos")]
            if EXPERIMENTAL_VOICE_CAPTURE {
                let (cmd_tx, cmd_rx) = mpsc::sync_channel(0);
                app.manage(SpeechCommandTx(Arc::new(cmd_tx)));
                std::thread::spawn(move || speech::run_speech_loop(cmd_rx));
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_entry,
            restore_entry,
            update_entry,
            list_entries,
            search_entries,
            run_native_speech_recognition,
            generate_embedding,
            find_similar_entries,
            get_resurfaced_entry,
            get_thought_trail,
            pin_entry,
            unpin_entry,
            get_pinned_entry_ids,
            record_entry_open,
            delete_entry,
            delete_all_entries,
            export_entries,
            create_backup,
            create_backup_if_needed,
            set_app_icon,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod related_entries_tests {
    use super::*;

    #[test]
    fn threshold_filters_low_similarity_before_sort_and_limit() {
        let with_sim = vec![
            ("weak".to_string(), 0.35),
            ("strong".to_string(), 0.72),
            ("boundary".to_string(), 0.5),
            ("noise".to_string(), 0.41),
            ("good".to_string(), 0.58),
        ];
        let ids = top_related_ids(with_sim, MIN_RELATED_SIMILARITY, 3);
        assert_eq!(ids, ["strong", "good", "boundary"]);
    }

    #[test]
    fn no_results_when_all_below_threshold() {
        let with_sim = vec![("a".to_string(), 0.3), ("b".to_string(), 0.4)];
        let ids = top_related_ids(with_sim, MIN_RELATED_SIMILARITY, 5);
        assert!(ids.is_empty());
    }

    #[test]
    fn limit_respected_after_filtering() {
        let with_sim = vec![
            ("1".to_string(), 0.9),
            ("2".to_string(), 0.8),
            ("3".to_string(), 0.7),
            ("4".to_string(), 0.6),
            ("5".to_string(), 0.55),
        ];
        let ids = top_related_ids(with_sim, MIN_RELATED_SIMILARITY, 2);
        assert_eq!(ids.len(), 2);
        assert_eq!(ids, ["1", "2"]);
    }
}

#[cfg(test)]
mod resurface_integration {
    use super::*;
    use rand::SeedableRng;
    use rand_chacha::ChaCha8Rng;
    use std::path::PathBuf;

    fn open_memory_db() -> Db {
        Db::open(PathBuf::from(":memory:")).expect("in-memory db")
    }

    #[test]
    fn at_most_one_entry_returned_per_call() {
        let db = open_memory_db();
        let now = chrono::Utc::now();
        let t24 = (now - chrono::Duration::days(1)).to_rfc3339();
        db.create_entry("a", "entry a", &t24).unwrap();
        let mut rng = ChaCha8Rng::seed_from_u64(1);
        let r = get_resurfaced_entry_impl(&db, vec![], &mut rng).unwrap();
        assert!(r.is_some());
        assert_eq!(r.as_ref().map(|p| p.entry.id.as_str()), Some("a"));
    }

    #[test]
    fn excluded_ids_never_returned() {
        let db = open_memory_db();
        let now = chrono::Utc::now();
        let t24 = (now - chrono::Duration::days(1)).to_rfc3339();
        let t7d = (now - chrono::Duration::days(7)).to_rfc3339();
        db.create_entry("id-24h", "thought 24h", &t24).unwrap();
        db.create_entry("id-7d", "thought 7d", &t7d).unwrap();
        let mut rng = ChaCha8Rng::seed_from_u64(2);
        let with_exclude =
            get_resurfaced_entry_impl(&db, vec!["id-24h".to_string()], &mut rng).unwrap();
        assert!(with_exclude.is_some());
        assert_eq!(with_exclude.as_ref().unwrap().entry.id, "id-7d");
    }

    #[test]
    fn cooldown_excluding_only_candidate_returns_none() {
        let db = open_memory_db();
        let now = chrono::Utc::now();
        let t24 = (now - chrono::Duration::days(1)).to_rfc3339();
        db.create_entry("only", "only entry", &t24).unwrap();
        let mut rng = ChaCha8Rng::seed_from_u64(3);
        let r = get_resurfaced_entry_impl(&db, vec!["only".to_string()], &mut rng).unwrap();
        assert!(r.is_none());
    }

    #[test]
    fn empty_db_returns_none() {
        let db = open_memory_db();
        let mut rng = ChaCha8Rng::seed_from_u64(4);
        let r = get_resurfaced_entry_impl(&db, vec![], &mut rng).unwrap();
        assert!(r.is_none());
    }
}
