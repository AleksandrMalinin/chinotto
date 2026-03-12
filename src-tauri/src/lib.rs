mod db;
mod embeddings;
mod keywords;

use db::Db;
use keywords::{extract_keywords, keyword_overlap, thought_trail_candidates, thought_trail_min_overlap};
use std::fs;
use tauri::Manager;

fn parse_created_at(iso: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    chrono::DateTime::parse_from_rfc3339(iso)
        .ok()
        .map(|dt| dt.with_timezone(&chrono::Utc))
}

fn format_ago(created: chrono::DateTime<chrono::Utc>, now: chrono::DateTime<chrono::Utc>) -> String {
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

#[tauri::command]
fn create_entry(db: tauri::State<Db>, text: String) -> Result<String, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().to_rfc3339();
    db.create_entry(&id, &text, &created_at).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn generate_embedding(db: tauri::State<Db>, entry_id: String) -> Result<(), String> {
    let entry = db
        .get_entry_by_id(&entry_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "entry not found")?;
    let vec = embeddings::embed_text(&entry.text).map_err(|e| e.to_string())?;
    db.insert_embedding(&entry_id, &vec).map_err(|e| e.to_string())?;
    Ok(())
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
    let mut with_sim: Vec<(String, f32)> = others
        .into_iter()
        .map(|(id, emb)| {
            let sim = embeddings::cosine_similarity(&query_embedding, &emb);
            (id, sim)
        })
        .collect();
    with_sim.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    let top_ids: Vec<String> = with_sim.into_iter().take(limit).map(|(id, _)| id).collect();
    let rows = db.get_entries_by_ids(&top_ids).map_err(|e| e.to_string())?;
    let by_id: std::collections::HashMap<String, db::EntryRow> = rows
        .into_iter()
        .map(|r| (r.id.clone(), r))
        .collect();
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
                topics: if topics.is_empty() { None } else { Some(topics) },
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
                topics: if topics.is_empty() { None } else { Some(topics) },
            }
        })
        .collect())
}

#[tauri::command]
fn get_resurfaced_entry(db: tauri::State<Db>) -> Result<Option<ResurfacedPayload>, String> {
    use rand::seq::SliceRandom;
    let now = chrono::Utc::now();
    let cutoff = (now - chrono::Duration::days(1)).to_rfc3339();
    let older = db
        .get_entries_with_embeddings_older_than(&cutoff)
        .map_err(|e| e.to_string())?;
    if older.is_empty() {
        return Ok(None);
    }
    let recent = db
        .get_recent_entries_with_embeddings(10)
        .map_err(|e| e.to_string())?;
    let recent_embeddings: Vec<(String, Vec<f32>)> = recent
        .iter()
        .filter_map(|e| db.get_embedding(&e.id).ok().flatten().map(|v| (e.id.clone(), v)))
        .collect();
    let older_embeddings: std::collections::HashMap<String, Vec<f32>> = older
        .iter()
        .filter_map(|e| db.get_embedding(&e.id).ok().flatten().map(|v| (e.id.clone(), v)))
        .collect();
    if older_embeddings.is_empty() {
        return Ok(None);
    }
    let mut scored: Vec<(db::EntryRow, f32)> = Vec::with_capacity(older.len());
    for entry in &older {
        let emb = match older_embeddings.get(&entry.id) {
            Some(e) => e,
            None => continue,
        };
        let created = match parse_created_at(&entry.created_at) {
            Some(c) => c,
            None => continue,
        };
        let age_days = (now - created).num_days() as f32;
        let age_score = if age_days >= 30.0 && age_days <= 180.0 {
            1.0
        } else if age_days >= 14.0 && age_days < 30.0 {
            0.7
        } else if age_days > 180.0 {
            0.6
        } else {
            0.5
        };
        let sim_recent = if recent_embeddings.is_empty() {
            0.5
        } else {
            recent_embeddings
                .iter()
                .map(|(_, re)| embeddings::cosine_similarity(emb, re))
                .sum::<f32>()
                / recent_embeddings.len() as f32
        };
        let recurring = older_embeddings
            .iter()
            .filter(|(id, _)| *id != &entry.id)
            .map(|(_, oe)| embeddings::cosine_similarity(emb, oe))
            .fold(0.0f32, |a, b| a + b);
        let n_other = (older_embeddings.len() - 1).max(1) as f32;
        let recurring_score = recurring / n_other;
        let score = 0.35 * age_score + 0.45 * sim_recent + 0.2 * recurring_score;
        scored.push((entry.clone(), score));
    }
    if scored.is_empty() {
        return Ok(None);
    }
    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    let top: Vec<_> = scored.into_iter().take(5).collect();
    let (picked, _) = top
        .choose(&mut rand::thread_rng())
        .or_else(|| top.first())
        .ok_or("empty top")?;
    let reason = format!(
        "You wrote this {}.",
        format_ago(parse_created_at(&picked.created_at).unwrap_or(now), now)
    );
    let topics = extract_keywords(&picked.text, keywords::default_topic_limit());
    Ok(Some(ResurfacedPayload {
        entry: EntryPayload {
            id: picked.id.clone(),
            text: picked.text.clone(),
            created_at: picked.created_at.clone(),
            topics: if topics.is_empty() { None } else { Some(topics) },
        },
        reason,
    }))
}

#[tauri::command]
fn get_thought_trail(db: tauri::State<Db>, entry_id: String) -> Result<Vec<EntryPayload>, String> {
    let current = db
        .get_entry_by_id(&entry_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "entry not found".to_string())?;
    let all = db.list_entries().map_err(|e| e.to_string())?;
    let candidates = all
        .into_iter()
        .filter(|r| r.id != entry_id)
        .take(thought_trail_candidates())
        .collect::<Vec<_>>();
    let min_overlap = thought_trail_min_overlap();
    let current_keywords = extract_keywords(&current.text, 15);
    if current_keywords.is_empty() {
        let limit = keywords::default_topic_limit();
        let topics = extract_keywords(&current.text, limit);
        return Ok(vec![EntryPayload {
            id: current.id,
            text: current.text.clone(),
            created_at: current.created_at.clone(),
            topics: if topics.is_empty() { None } else { Some(topics) },
        }]);
    }
    let mut with_overlap: Vec<(db::EntryRow, usize)> = candidates
        .into_iter()
        .map(|r| {
            let n = keyword_overlap(&current.text, &r.text);
            (r, n)
        })
        .filter(|(_, n)| *n >= min_overlap)
        .collect();
    with_overlap.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| b.0.created_at.cmp(&a.0.created_at)));
    let limit = keywords::default_topic_limit();
    let mut out = vec![EntryPayload {
        id: current.id.clone(),
        text: current.text.clone(),
        created_at: current.created_at.clone(),
        topics: {
            let t = extract_keywords(&current.text, limit);
            if t.is_empty() { None } else { Some(t) }
        },
    }];
    for (row, _) in with_overlap.into_iter().take(8) {
        let topics = extract_keywords(&row.text, limit);
        out.push(EntryPayload {
            id: row.id,
            text: row.text,
            created_at: row.created_at,
            topics: if topics.is_empty() { None } else { Some(topics) },
        });
    }
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
                topics: if topics.is_empty() { None } else { Some(topics) },
            }
        })
        .collect())
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
        .invoke_handler(tauri::generate_handler![
            create_entry,
            list_entries,
            search_entries,
            generate_embedding,
            find_similar_entries,
            get_resurfaced_entry,
            get_thought_trail,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
