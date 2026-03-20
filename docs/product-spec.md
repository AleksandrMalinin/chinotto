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

### Empty stream onboarding

When the **main stream has no entries** (unpinned stream only; not the “no search results” message), the app shows the existing onboarding block (panel + copy). This is **progressive and state-based**, not a separate tutorial: no modals, no steps, no blocking of the capture input.

| Piece | Behavior |
|--------|-----------|
| **Intro** | While the intro is open, onboarding content stays in a non-visible motion state and the trail panel’s CSS draw/drift does **not** start. When the user **starts** exiting intro (main fades in, logo flies to header), the **staggered entrance** and trail motion begin shortly after (~750ms)—same handoff as the main UI, not when the logo move ends, with a minimal beat so the motion is easy to notice. Same stagger again when the block returns after other triggers below. |
| **Dismiss** | On the **first character** in the capture field, or after a **successful save** while the stream was still empty, the block **fades out** briefly (~150–250ms) and is removed; a **placeholder** keeps vertical space so layout does not jump. |
| **Restore without saving** | If the user **clears the capture field** (trim-empty) and the stream is still empty, onboarding **shows again** with the same staggered entrance. |
| **Stream non-empty** | No onboarding; no hints in the stream area. |
| **Empty again after having entries** | When the stream goes from having entries to **zero** again, onboarding can reappear. If the user has **ever saved an entry** (see persistence below), the variant is **soft**; otherwise **full**. |

**Variants (same copy and layout; different emphasis only)**

| Variant | When | Effect |
|---------|------|--------|
| **full** | Stream empty and the user has **never** persisted `hasEverSaved` (see below). | Block at full opacity. |
| **soft** | Stream empty and `hasEverSaved` is set (at least one entry was saved in the past, even if later deleted). | Same content; whole block at **lower opacity** (~58%) so it reads as a quiet reminder, not a first-run screen. |

**Persistence**

- `localStorage` key **`chinotto.hasEverSavedThought`** is set to `1` after a **successful** `create_entry`. It is not cleared when entries are deleted. Used only to choose **full** vs **soft** when the stream is empty again.

**Optional feedback**

- While the user types (before dismiss), a **short one-shot** accent can run on the trail SVG; reduced motion disables it.

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
