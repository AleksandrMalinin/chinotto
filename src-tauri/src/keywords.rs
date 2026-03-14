// Lightweight keyword extraction for thought trails and micro topics.
// No ML, no external deps: tokenize, drop stopwords, count, take top N.

const MIN_LEN: usize = 3;
const DEFAULT_TOPIC_LIMIT: usize = 5;
const THOUGHT_TRAIL_MIN_OVERLAP: usize = 2;
const THOUGHT_TRAIL_CANDIDATES: usize = 250;

/// Common English stopwords (lowercase). Kept small for a minimal set.
static STOPWORDS: &[&str] = &[
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "do", "does", "did", "will", "would", "could", "should", "may", "might", "must", "shall",
    "can", "need", "to", "of", "in", "for", "on", "with", "at", "by", "from", "as", "into",
    "through", "during", "before", "after", "and", "but", "if", "or", "because", "until", "while",
    "this", "that", "these", "those", "it", "its", "not", "no", "only", "same", "so", "than",
    "too", "very", "just", "all", "each", "every", "both", "few", "more", "most", "other", "some",
    "such", "own",
];

fn is_stopword(w: &str) -> bool {
    let w = w.trim();
    if w.len() < MIN_LEN {
        return true;
    }
    STOPWORDS.contains(&w)
}

/// Tokenize: split on non-alphanumeric (unicode-friendly), lowercase.
fn tokenize(text: &str) -> Vec<String> {
    text.split(|c: char| !c.is_alphanumeric())
        .map(|s| s.to_lowercase())
        .filter(|s| s.len() >= MIN_LEN && !is_stopword(s))
        .collect()
}

/// Extract top keywords by frequency in text. Returns up to `limit` words, most frequent first.
pub fn extract_keywords(text: &str, limit: usize) -> Vec<String> {
    let tokens = tokenize(text);
    if tokens.is_empty() {
        return vec![];
    }
    let mut counts: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
    for t in tokens {
        *counts.entry(t).or_insert(0) += 1;
    }
    let mut by_count: Vec<(String, u32)> = counts.into_iter().collect();
    by_count.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
    by_count.into_iter().take(limit).map(|(s, _)| s).collect()
}

/// Number of shared keywords between two texts (for thought trail linking).
pub fn keyword_overlap(text_a: &str, text_b: &str) -> usize {
    let a: std::collections::HashSet<String> = tokenize(text_a).into_iter().collect();
    let b: std::collections::HashSet<String> = tokenize(text_b).into_iter().collect();
    a.intersection(&b).count()
}

/// Tokenize and return set of terms (for IDF and similarity).
pub fn token_set(text: &str) -> std::collections::HashSet<String> {
    tokenize(text).into_iter().collect()
}

/// Similarity score 0..1 for thought trail: weighted keyword overlap (IDF-like).
/// Rare terms that appear in both texts contribute more. `corpus` = token sets of all candidate texts.
pub fn thought_trail_similarity(
    current_text: &str,
    other_text: &str,
    corpus_token_sets: &[std::collections::HashSet<String>],
    keyword_limit: usize,
) -> f64 {
    let current_kw: Vec<String> = extract_keywords(current_text, keyword_limit)
        .into_iter()
        .collect();
    if current_kw.is_empty() {
        return 0.0;
    }
    let other_tokens = token_set(other_text);
    let mut weighted_overlap = 0.0;
    let mut denom = 0.0;
    for term in &current_kw {
        let df = 1 + corpus_token_sets
            .iter()
            .filter(|s| s.contains(term))
            .count();
        let idf = 1.0 / (df as f64);
        denom += idf;
        if other_tokens.contains(term) {
            weighted_overlap += idf;
        }
    }
    if denom <= 0.0 {
        return 0.0;
    }
    weighted_overlap / denom
}

pub fn default_topic_limit() -> usize {
    DEFAULT_TOPIC_LIMIT
}

pub fn thought_trail_min_overlap() -> usize {
    THOUGHT_TRAIL_MIN_OVERLAP
}

pub fn thought_trail_candidates() -> usize {
    THOUGHT_TRAIL_CANDIDATES
}

/// Max related entries in thought trail (before + after current). Total trail = 1 + this.
pub fn thought_trail_max_related() -> usize {
    4
}
