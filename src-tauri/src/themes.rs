pub const SYSTEM_THEME_LINKS: &str = "links";

#[derive(Clone, Debug, PartialEq)]
pub struct ThemeClassification {
    pub theme_id: String,
    pub confidence: f64,
    pub source: &'static str,
}

fn has_url(text: &str) -> bool {
    if text.contains("http://") || text.contains("https://") {
        return true;
    }
    text.split_whitespace().any(|word| {
        let w = word.trim_matches(|c: char| ".,;:!?)".contains(c));
        w.starts_with("www.") && w.len() > 4
    })
}

/// Automatic theme assignment: URL entries → links only. User themes are manual in detail.
pub fn classify_entry_text(text: &str) -> Option<ThemeClassification> {
    if has_url(text) {
        return Some(ThemeClassification {
            theme_id: SYSTEM_THEME_LINKS.to_string(),
            confidence: 1.0,
            source: "url",
        });
    }
    None
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
    fn plain_text_returns_none() {
        assert!(classify_entry_text("Coffee and a walk").is_none());
    }

    #[test]
    fn book_like_text_returns_none_without_auto_keywords() {
        assert!(classify_entry_text("The protagonist in chapter three feels lost").is_none());
    }
}
