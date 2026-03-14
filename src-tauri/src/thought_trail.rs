//! Pure thought trail ranking: keyword overlap + time proximity.
//! No DB, no embeddings; deterministic and testable.

use crate::keywords::{keyword_overlap, thought_trail_min_overlap, thought_trail_similarity, token_set};
use std::collections::HashSet;

fn parse_created_at(iso: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    chrono::DateTime::parse_from_rfc3339(iso)
        .ok()
        .map(|dt| dt.with_timezone(&chrono::Utc))
}

/// Minimal entry for ranking (id, text, created_at).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TrailEntry {
    pub id: String,
    pub text: String,
    pub created_at: String,
}

/// Rank related entries by keyword overlap and time proximity.
/// Returns up to `max_related` entries, sorted by score descending; never includes current.
pub fn rank_related_entries(
    current: &TrailEntry,
    entries: &[TrailEntry],
    max_related: usize,
) -> Vec<TrailEntry> {
    let min_overlap = thought_trail_min_overlap();
    let current_ts = match parse_created_at(&current.created_at) {
        Some(t) => t,
        None => return vec![],
    };
    let candidates: Vec<&TrailEntry> = entries
        .iter()
        .filter(|e| e.id != current.id)
        .collect();
    if candidates.is_empty() {
        return vec![];
    }
    let corpus: Vec<HashSet<String>> = candidates
        .iter()
        .map(|e| token_set(&e.text))
        .collect();
    let mut scored: Vec<(TrailEntry, f64)> = candidates
        .iter()
        .filter(|e| keyword_overlap(&current.text, &e.text) >= min_overlap)
        .map(|e| {
            let sim = thought_trail_similarity(&current.text, &e.text, &corpus, 15);
            let other_ts = parse_created_at(&e.created_at).unwrap_or(current_ts);
            let days = (current_ts - other_ts).num_days().unsigned_abs() as f64;
            let time_score = 1.0 / (1.0 + days);
            let score = 0.6 * sim + 0.4 * time_score;
            ((*e).clone(), score)
        })
        .collect();
    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    scored
        .into_iter()
        .take(max_related)
        .map(|(e, _)| e)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(id: &str, text: &str, created_at: &str) -> TrailEntry {
        TrailEntry {
            id: id.to_string(),
            text: text.to_string(),
            created_at: created_at.to_string(),
        }
    }

    #[test]
    fn entries_with_keyword_overlap_rank_higher() {
        let now = chrono::Utc::now();
        let now_iso = now.to_rfc3339();
        let current = entry("cur", "project pipeline design", &now_iso);
        let related = entry("a", "pipeline design and deployment", &(now - chrono::Duration::days(2)).to_rfc3339());
        let unrelated = entry("b", "meeting tomorrow lunch", &(now - chrono::Duration::days(1)).to_rfc3339());
        let entries = vec![current.clone(), related.clone(), unrelated.clone()];
        let result = rank_related_entries(&current, &entries, 4);
        assert!(!result.is_empty());
        assert_eq!(result[0].id, "a");
        assert!(!result.iter().any(|e| e.id == "cur"));
    }

    #[test]
    fn entries_closer_in_time_rank_higher() {
        let now = chrono::Utc::now();
        let current = entry("cur", "design review feedback", &now.to_rfc3339());
        let near = entry("near", "design review notes", &(now - chrono::Duration::days(1)).to_rfc3339());
        let far = entry("far", "design review draft", &(now - chrono::Duration::days(90)).to_rfc3339());
        let entries = vec![current.clone(), near.clone(), far.clone()];
        let result = rank_related_entries(&current, &entries, 4);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].id, "near");
        assert_eq!(result[1].id, "far");
    }

    #[test]
    fn unrelated_entries_rank_lowest_or_excluded() {
        let now = chrono::Utc::now();
        let current = entry("cur", "pipeline design", &now.to_rfc3339());
        let related = entry("r", "pipeline design notes", &(now - chrono::Duration::days(1)).to_rfc3339());
        let unrelated1 = entry("u1", "buy milk", &(now - chrono::Duration::days(2)).to_rfc3339());
        let unrelated2 = entry("u2", "call mom", &(now - chrono::Duration::days(3)).to_rfc3339());
        let entries = vec![current.clone(), related.clone(), unrelated1.clone(), unrelated2.clone()];
        let result = rank_related_entries(&current, &entries, 4);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].id, "r");
    }

    #[test]
    fn result_list_is_limited() {
        let now = chrono::Utc::now();
        let current = entry("cur", "alpha beta gamma delta", &now.to_rfc3339());
        let mut entries = vec![current.clone()];
        for i in 0..10 {
            entries.push(entry(
                &format!("e{}", i),
                "alpha beta gamma delta echo",
                &(now - chrono::Duration::days(i as i64 + 1)).to_rfc3339(),
            ));
        }
        let result = rank_related_entries(&current, &entries, 4);
        assert!(result.len() <= 4);
    }

    #[test]
    fn result_list_respects_max_related_three() {
        let now = chrono::Utc::now();
        let current = entry("cur", "foo bar baz", &now.to_rfc3339());
        let mut entries = vec![current.clone()];
        for i in 0..5 {
            entries.push(entry(
                &format!("e{}", i),
                "foo bar baz qux",
                &(now - chrono::Duration::days(i as i64 + 1)).to_rfc3339(),
            ));
        }
        let result = rank_related_entries(&current, &entries, 3);
        assert!(result.len() <= 3, "max_related=3 must cap at 3 entries");
    }

    #[test]
    fn current_entry_never_returned() {
        let now = chrono::Utc::now();
        let current = entry("cur", "shared keywords here", &now.to_rfc3339());
        let other = entry("other", "shared keywords there", &(now - chrono::Duration::days(1)).to_rfc3339());
        let entries = vec![current.clone(), other.clone()];
        let result = rank_related_entries(&current, &entries, 4);
        assert!(!result.iter().any(|e| e.id == current.id));
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].id, "other");
    }

    #[test]
    fn empty_entries_returns_empty() {
        let now = chrono::Utc::now();
        let current = entry("cur", "something", &now.to_rfc3339());
        let entries: Vec<TrailEntry> = vec![];
        let result = rank_related_entries(&current, &entries, 4);
        assert!(result.is_empty());
    }

    #[test]
    fn only_current_returns_empty() {
        let now = chrono::Utc::now();
        let current = entry("cur", "something", &now.to_rfc3339());
        let entries = vec![current.clone()];
        let result = rank_related_entries(&current, &entries, 4);
        assert!(result.is_empty());
    }

    #[test]
    fn small_dataset_with_one_related() {
        let now = chrono::Utc::now();
        let current = entry("cur", "hello world test", &now.to_rfc3339());
        let other = entry("other", "hello world example", &(now - chrono::Duration::days(5)).to_rfc3339());
        let entries = vec![current.clone(), other.clone()];
        let result = rank_related_entries(&current, &entries, 4);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].id, "other");
    }

    #[test]
    fn ranking_is_deterministic() {
        let now = chrono::Utc::now();
        let current = entry("cur", "design system tokens", &now.to_rfc3339());
        let a = entry("a", "design system colors", &(now - chrono::Duration::days(1)).to_rfc3339());
        let b = entry("b", "design system spacing", &(now - chrono::Duration::days(2)).to_rfc3339());
        let entries = vec![current.clone(), a.clone(), b.clone()];
        let r1 = rank_related_entries(&current, &entries, 4);
        let r2 = rank_related_entries(&current, &entries, 4);
        assert_eq!(r1.len(), r2.len());
        for (e1, e2) in r1.iter().zip(r2.iter()) {
            assert_eq!(e1.id, e2.id);
        }
    }
}
