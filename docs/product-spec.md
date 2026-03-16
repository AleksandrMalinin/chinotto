# Chinotto – Product spec

## Summary

Chinotto is a minimal desktop thinking tool for instantly capturing thoughts and recovering context later. It targets people who handle a lot of information, flows, decisions, and ideas every day and need a simple place to dump thoughts without organizing them up front.

## Philosophy

- **Capture first, structure later**
- No workspace overhead
- No document mindset
- No manual organization at write time

## Constraints

- Desktop app only
- Local-first
- Single-user
- No sync (for now)
- No collaboration
- No auth
- No cloud dependencies
- No pages, folders, or documents
- No markdown editor
- No tasks, kanban, or templates
- No AI chat
- Embeddings used only for thought trail / related entries; no standalone “similar entries” UI
- One canonical entity only: **Entry**

## Proposal guardrails

Use these when evaluating or proposing changes. Chinotto is **not** a knowledge management system, document editor, or productivity suite. It **is** a thinking stream, a place to capture thoughts instantly, and a memory layer that helps recover past context.

**Do not introduce:** folders, tags, collections, dashboards, AI chat, recommendation feeds.

**All improvements must preserve:** (1) minimal UI, (2) local-first architecture, (3) single entity model (Entry), (4) extremely low noise.

**Success metric:** The system should feel like **a calm memory**, not a smart assistant.

**Prefer:** subtle recall, time-based memory, contextual connections. **Avoid** adding complexity unless it clearly improves “recover context later.”

---

## Current product state

What the app does today. Single source of truth for “do we have this?” and “how does it work?”

### Core flows

| Flow | Description |
|------|-------------|
| **Capture** | Open app → input focused → type → **Enter** creates a new entry. One stream, no folders. |
| **Stream** | Entries in reverse chronological order (newest first). Click an entry to open detail. |
| **Search** | **Cmd+K** (Mac) / **Ctrl+K** (Win/Linux) opens search. Full-text search (FTS5) across all entries. Escape or clear query to return to stream. |

### Entry actions

| Action | How |
|--------|-----|
| **Pin** | **Cmd+P** with focus/hover on an entry, or from entry detail. Pinned entry id stored; stream can show pin indicator. |
| **Unpin** | From entry detail when entry is pinned. |
| **Edit** | **Cmd+E** on hovered/focused entry, or inline from detail. Updates text in place. |
| **Delete** | **Cmd+Backspace** on hovered entry, or from entry detail. Entry removed from DB. |

### Context and discovery

| Feature | Description |
|---------|-------------|
| **Resurface** | At most one per session; only on app open or after saving an entry. Temporal recall (24h / 7d / 30d ±3h or random fallback). Message is memory-style. Entries shown recently are in cooldown (7 days). Sometimes the app shows nothing—silence is acceptable. See `docs/recall-guardrails.md`. |
| **Thought trail** | From an entry’s detail view: “Thought trail” shows how the thought evolved—entries ordered earlier → current → later, scored by keyword similarity (IDF-weighted) and temporal proximity. Max 4 related; labels like “12 days earlier” / “3 days later”. Keyword-based only (no embeddings in this view). |

### App chrome and settings

| Feature | Description |
|---------|-------------|
| **Intro** | First run: short intro screen, then transition to main view. |
| **Settings (Chinotto Card)** | Click logo (top-left) → Settings panel: icon picker, privacy, shortcuts. Escape to close. |
| **Focus input** | **Cmd+N** focuses the main capture input. |
| **Export** | File → Export Entries…: all entries as Markdown (YAML frontmatter) in a ZIP; filenames by timestamp, chronological order. |
| **Backup** | File → Backup Now. Automatic backup on launch (max once per 24h); last 7 in chinotto-backups/. |

### Shortcuts (current)

| Shortcut | Action |
|----------|--------|
| Enter | Save thought (from capture input) |
| ⌘ P | Pin thought (hovered/focused entry) |
| ⌘ K | Search |
| ⌘ ⌫ (Backspace) | Delete thought (hovered entry) |
| ⌘ E | Edit hovered/focused entry |
| Esc | Close overlays / back to stream |

(Settings also lists ⌘ N “Focus input”; not yet wired globally.)

### Data model

**Entry**

| Field       | Type   | Notes        |
|------------|--------|--------------|
| id         | string | Primary key  |
| text       | string | Content      |
| created_at | string | ISO 8601 UTC |

Pinned state is stored separately (pinned entry id(s)); no extra fields on Entry.

### Not in the main product (disabled or internal)

| Item | Status |
|------|--------|
| **Voice capture** | Implemented (macOS native speech) but **disabled** in the main flow. Gated by `EXPERIMENTAL_VOICE_CAPTURE`; see `docs/architecture.md` (Experimental / disabled features). |
| **Embeddings / similarity** | Backend can generate embeddings and find similar entries; used for thought trail and resurface logic. Not exposed as a standalone “similar entries” UI beyond thought trail. |

---

## MVP flows (reference)

Original MVP scope; most of it is shipped and extended by the list above.

### 1. Capture

- Open the app
- Input is focused immediately
- User starts typing right away
- Pressing Enter creates a new entry

### 2. Stream

- Entries shown in reverse chronological order
- Minimal timeline-like structure

### 3. Search

- Full-text search across entries
- Very fast and simple
