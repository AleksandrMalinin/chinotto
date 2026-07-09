use crate::keywords::token_set;

#[derive(Clone, Debug, PartialEq)]
pub struct ThemeClassification {
    pub theme_id: &'static str,
    pub confidence: f64,
    pub source: &'static str,
}

static BOOK_KEYWORDS: &[&str] = &[
    "chapter",
    "character",
    "plot",
    "scene",
    "protagonist",
    "novel",
    "manuscript",
    "writer",
    "dialogue",
    "narrator",
    "draft",
];

static THERAPY_KEYWORDS: &[&str] = &[
    "anxiety",
    "therapist",
    "therapy",
    "session",
    "feeling",
    "feelings",
    "trauma",
    "grief",
    "depression",
    "emotional",
    "scared",
    "afraid",
    "cope",
    "coping",
];

fn has_url(text: &str) -> bool {
    if text.contains("http://") || text.contains("https://") {
        return true;
    }
    text.split_whitespace().any(|word| {
        let w = word.trim_matches(|c: char| ".,;:!?)".contains(c));
        w.starts_with("www.") && w.len() > 4
    })
}

fn keyword_hits(text: &str, keywords: &[&str]) -> usize {
    let tokens = token_set(text);
    keywords.iter().filter(|kw| tokens.contains(**kw)).count()
}

fn classify_by_keywords(text: &str) -> Option<ThemeClassification> {
    let book_hits = keyword_hits(text, BOOK_KEYWORDS);
    let therapy_hits = keyword_hits(text, THERAPY_KEYWORDS);

    if book_hits > 0 && therapy_hits > 0 {
        return None;
    }
    if book_hits > 0 {
        let confidence = if book_hits >= 2 { 0.9 } else { 0.8 };
        return Some(ThemeClassification {
            theme_id: "book",
            confidence,
            source: "keyword",
        });
    }
    if therapy_hits > 0 {
        let confidence = if therapy_hits >= 2 { 0.9 } else { 0.8 };
        return Some(ThemeClassification {
            theme_id: "therapy",
            confidence,
            source: "keyword",
        });
    }
    None
}

pub fn classify_entry_text(text: &str) -> Option<ThemeClassification> {
    if has_url(text) {
        return Some(ThemeClassification {
            theme_id: "links",
            confidence: 1.0,
            source: "url",
        });
    }
    classify_by_keywords(text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn url_maps_to_links() {
        let r = classify_entry_text("Watch https://letterboxd.com/film/x").unwrap();
        assert_eq!(r.theme_id, "links");
        assert_eq!(r.confidence, 1.0);
        assert_eq!(r.source, "url");
    }

    #[test]
    fn book_keywords_classify() {
        let r = classify_entry_text("The protagonist in chapter three feels lost").unwrap();
        assert_eq!(r.theme_id, "book");
        assert!(r.confidence >= 0.8);
    }

    #[test]
    fn therapy_keywords_classify() {
        let r = classify_entry_text("Anxiety before the therapy session today").unwrap();
        assert_eq!(r.theme_id, "therapy");
    }

    #[test]
    fn conflicting_keywords_return_none() {
        assert!(classify_entry_text("The protagonist's anxiety in chapter two").is_none());
    }

    #[test]
    fn plain_text_returns_none() {
        assert!(classify_entry_text("Coffee and a walk").is_none());
    }
}
