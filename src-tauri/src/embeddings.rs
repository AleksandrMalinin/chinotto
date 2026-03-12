use fastembed::{EmbeddingModel, InitOptions, TextEmbedding};
use once_cell::sync::OnceCell;
use std::sync::Mutex;

static MODEL: OnceCell<Mutex<Option<TextEmbedding>>> = OnceCell::new();

fn get_model() -> Result<std::sync::MutexGuard<'static, Option<TextEmbedding>>, String> {
    let cell = MODEL.get_or_try_init(|| -> Result<Mutex<Option<TextEmbedding>>, String> {
        let model = TextEmbedding::try_new(
            InitOptions::new(EmbeddingModel::AllMiniLML6V2).with_show_download_progress(false),
        )
        .map_err(|e| e.to_string())?;
        Ok(Mutex::new(Some(model)))
    })?;
    cell.lock().map_err(|e| e.to_string())
}

pub fn embed_text(text: &str) -> Result<Vec<f32>, String> {
    let mut guard = get_model()?;
    let model = guard.as_mut().ok_or("embedding model not loaded")?;
    let texts = vec![text.to_string()];
    let embeddings = model.embed(&texts, None).map_err(|e| e.to_string())?;
    let vec = embeddings.into_iter().next().ok_or("no embedding returned")?;
    Ok(vec)
}

pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }
    dot / (norm_a * norm_b)
}
