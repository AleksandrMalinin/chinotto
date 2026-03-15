//! Pure temporal recall algorithm: select one entry for resurfacing.
//! Isolated from DB and UI; testable with deterministic fixtures.

use rand::seq::SliceRandom;
use rand::Rng;
use std::collections::HashSet;

const WINDOW_HOURS: i64 = 3;
const IMPORTANCE_PIN: f64 = 1.0;
const IMPORTANCE_EDIT_FACTOR: f64 = 0.5;
const IMPORTANCE_EDIT_CAP: f64 = 2.0;
const IMPORTANCE_OPEN_FACTOR: f64 = 0.2;
const IMPORTANCE_OPEN_CAP: f64 = 1.5;
const IMPORTANCE_BOOST_WEIGHT: f64 = 0.08;

/// Minimal entry shape for selection (no DB dependency).
#[derive(Clone, Debug)]
pub struct ResurfaceEntry {
    pub id: String,
    pub text: String,
    pub created_at: String,
    pub edit_count: u32,
    pub open_count: u32,
}

/// Which anchor or fallback produced the selection.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Anchor {
    Anchor24h,
    Anchor7d,
    Anchor30d,
    Fallback,
}

fn parse_created_at(iso: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    chrono::DateTime::parse_from_rfc3339(iso)
        .ok()
        .map(|dt| dt.with_timezone(&chrono::Utc))
}

fn importance_weight(entry: &ResurfaceEntry, pinned_ids: &HashSet<&str>) -> f64 {
    let pin = if pinned_ids.contains(entry.id.as_str()) {
        IMPORTANCE_PIN
    } else {
        0.0
    };
    let edit = (entry.edit_count as f64 * IMPORTANCE_EDIT_FACTOR).min(IMPORTANCE_EDIT_CAP);
    let open = (entry.open_count as f64 * IMPORTANCE_OPEN_FACTOR).min(IMPORTANCE_OPEN_CAP);
    let importance = pin + edit + open;
    1.0 + IMPORTANCE_BOOST_WEIGHT * importance
}

/// Select one entry for resurfacing: try 24h, 7d, 30d anchors (±3h), then fallback.
/// Excluded ids are skipped. Uses `rng` for deterministic tests.
pub fn select_entry_for_resurface<R: Rng>(
    entries: &[ResurfaceEntry],
    now: chrono::DateTime<chrono::Utc>,
    exclude_ids: &HashSet<&str>,
    pinned_ids: &HashSet<&str>,
    rng: &mut R,
) -> Option<(ResurfaceEntry, Anchor)> {
    let window = chrono::Duration::hours(WINDOW_HOURS);
    let allowed: Vec<&ResurfaceEntry> = entries
        .iter()
        .filter(|e| !exclude_ids.contains(e.id.as_str()))
        .collect();
    if allowed.is_empty() {
        return None;
    }

    let anchors: [(chrono::Duration, Anchor); 3] = [
        (chrono::Duration::days(1), Anchor::Anchor24h),
        (chrono::Duration::days(7), Anchor::Anchor7d),
        (chrono::Duration::days(30), Anchor::Anchor30d),
    ];

    for (delta, anchor) in anchors {
        let target = now - delta;
        let from_ts = target - window;
        let to_ts = target + window;
        let in_window: Vec<&ResurfaceEntry> = allowed
            .iter()
            .filter(|e| {
                parse_created_at(&e.created_at).map_or(false, |t| t >= from_ts && t <= to_ts)
            })
            .copied()
            .collect();
        if in_window.is_empty() {
            continue;
        }
        let weighted: Vec<(&ResurfaceEntry, f64)> = in_window
            .iter()
            .map(|e| (*e, importance_weight(e, pinned_ids)))
            .collect();
        if let Ok(picked) = weighted.choose_weighted(rng, |(_, w)| *w) {
            return Some((picked.0.clone(), anchor));
        }
    }

    let weighted: Vec<(&ResurfaceEntry, f64)> = allowed
        .iter()
        .map(|e| (*e, importance_weight(e, pinned_ids)))
        .collect();
    weighted
        .choose_weighted(rng, |(_, w)| *w)
        .ok()
        .map(|picked| (picked.0.clone(), Anchor::Fallback))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::SeedableRng;
    use rand_chacha::ChaCha8Rng;

    fn entry(id: &str, created_at: &str, text: &str) -> ResurfaceEntry {
        ResurfaceEntry {
            id: id.to_string(),
            text: text.to_string(),
            created_at: created_at.to_string(),
            edit_count: 0,
            open_count: 0,
        }
    }

    fn seeded_rng() -> ChaCha8Rng {
        ChaCha8Rng::seed_from_u64(42)
    }

    #[test]
    fn entry_near_24h_is_preferred() {
        let now = chrono::Utc::now();
        let e_24h = entry(
            "a",
            &(now - chrono::Duration::hours(23)).to_rfc3339(),
            "near 24h",
        );
        let e_7d = entry(
            "b",
            &(now - chrono::Duration::days(7)).to_rfc3339(),
            "near 7d",
        );
        let entries = vec![e_24h.clone(), e_7d];
        let exclude: HashSet<&str> = HashSet::new();
        let pinned: HashSet<&str> = HashSet::new();
        let mut rng = seeded_rng();
        let result = select_entry_for_resurface(&entries, now, &exclude, &pinned, &mut rng);
        let (selected, anchor) = result.expect("should select one");
        assert_eq!(selected.id, "a");
        assert_eq!(anchor, Anchor::Anchor24h);
    }

    #[test]
    fn fallback_to_7d_anchor_when_no_24h() {
        let now = chrono::Utc::now();
        let e_7d = entry(
            "b",
            &(now - chrono::Duration::days(7) + chrono::Duration::hours(1)).to_rfc3339(),
            "near 7d",
        );
        let e_30d = entry(
            "c",
            &(now - chrono::Duration::days(30)).to_rfc3339(),
            "near 30d",
        );
        let entries = vec![e_7d.clone(), e_30d];
        let exclude: HashSet<&str> = HashSet::new();
        let pinned: HashSet<&str> = HashSet::new();
        let mut rng = seeded_rng();
        let result = select_entry_for_resurface(&entries, now, &exclude, &pinned, &mut rng);
        let (selected, anchor) = result.expect("should select one");
        assert_eq!(selected.id, "b");
        assert_eq!(anchor, Anchor::Anchor7d);
    }

    #[test]
    fn fallback_to_30d_anchor_when_no_24h_or_7d() {
        let now = chrono::Utc::now();
        let e_30d = entry(
            "c",
            &(now - chrono::Duration::days(30) + chrono::Duration::hours(2)).to_rfc3339(),
            "near 30d",
        );
        let e_old = entry("d", &(now - chrono::Duration::days(60)).to_rfc3339(), "old");
        let entries = vec![e_30d.clone(), e_old];
        let exclude: HashSet<&str> = HashSet::new();
        let pinned: HashSet<&str> = HashSet::new();
        let mut rng = seeded_rng();
        let result = select_entry_for_resurface(&entries, now, &exclude, &pinned, &mut rng);
        let (selected, anchor) = result.expect("should select one");
        assert_eq!(selected.id, "c");
        assert_eq!(anchor, Anchor::Anchor30d);
    }

    #[test]
    fn random_fallback_when_no_anchors_match() {
        let now = chrono::Utc::now();
        let e1 = entry(
            "x",
            &(now - chrono::Duration::days(10)).to_rfc3339(),
            "ten days",
        );
        let e2 = entry(
            "y",
            &(now - chrono::Duration::days(45)).to_rfc3339(),
            "45 days",
        );
        let entries = vec![e1.clone(), e2.clone()];
        let exclude: HashSet<&str> = HashSet::new();
        let pinned: HashSet<&str> = HashSet::new();
        let mut rng = seeded_rng();
        let result = select_entry_for_resurface(&entries, now, &exclude, &pinned, &mut rng);
        let (selected, anchor) = result.expect("should select one");
        assert_eq!(anchor, Anchor::Fallback);
        assert!(selected.id == "x" || selected.id == "y");
    }

    #[test]
    fn recently_resurfaced_entries_are_skipped() {
        let now = chrono::Utc::now();
        let e_24h = entry(
            "a",
            &(now - chrono::Duration::hours(24)).to_rfc3339(),
            "near 24h",
        );
        let e_other = entry(
            "b",
            &(now - chrono::Duration::days(5)).to_rfc3339(),
            "other",
        );
        let entries = vec![e_24h.clone(), e_other.clone()];
        let mut exclude: HashSet<&str> = HashSet::new();
        exclude.insert("a");
        let pinned: HashSet<&str> = HashSet::new();
        let mut rng = seeded_rng();
        let result = select_entry_for_resurface(&entries, now, &exclude, &pinned, &mut rng);
        let (selected, anchor) = result.expect("should select one");
        assert_eq!(selected.id, "b");
        assert_eq!(anchor, Anchor::Fallback);
    }

    #[test]
    fn empty_entries_returns_none() {
        let now = chrono::Utc::now();
        let entries: Vec<ResurfaceEntry> = vec![];
        let exclude: HashSet<&str> = HashSet::new();
        let pinned: HashSet<&str> = HashSet::new();
        let mut rng = seeded_rng();
        let result = select_entry_for_resurface(&entries, now, &exclude, &pinned, &mut rng);
        assert!(result.is_none());
    }

    #[test]
    fn all_excluded_returns_none() {
        let now = chrono::Utc::now();
        let e = entry(
            "a",
            &(now - chrono::Duration::hours(24)).to_rfc3339(),
            "only",
        );
        let entries = vec![e];
        let mut exclude: HashSet<&str> = HashSet::new();
        exclude.insert("a");
        let pinned: HashSet<&str> = HashSet::new();
        let mut rng = seeded_rng();
        let result = select_entry_for_resurface(&entries, now, &exclude, &pinned, &mut rng);
        assert!(result.is_none());
    }
}
