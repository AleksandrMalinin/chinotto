# Chinotto – Architecture

## Stack

- **Tauri 2:** Desktop shell; small binary, system WebView, Rust backend.
- **React + TypeScript:** UI; Vite for dev and build.
- **SQLite:** Local storage; one file per app instance, no server.
- **SQLite FTS5:** Full-text search over entries.

## Why Tauri

- Desktop-only target; no need for a full browser or Electron’s weight.
- Rust backend for safe, fast access to SQLite and the filesystem.
- Single binary (plus system WebView) and straightforward distribution.

## Why SQLite

- Local-first: no network, no auth, no sync in MVP.
- One file (e.g. in app data dir); easy to backup and inspect.
- FTS5 gives good full-text search without extra services.
- Boring, stable, and well-understood.

## Why a single Entry model

The product is “capture first, structure later.” The MVP avoids folders, pages, and documents. A single **Entry** entity (id, text, created_at) keeps the model minimal and the UI focused on capture and search. Structure can be added later without changing the core entity.

## Out of scope for MVP

- Sync, collaboration, auth, cloud
- Pages, folders, documents, markdown editor
- Tasks, kanban, templates
- AI chat, embeddings
- Mobile or web targets

## Project layout

- `src/` – React UI: `features/entries`, `types`, `lib`, `ui`
- `src-tauri/` – Rust: app entry, Tauri setup, `db` (SQLite + FTS5 schema and commands)
- `docs/` – Product and architecture notes

Frontend calls backend via Tauri `invoke()` for `create_entry`, `list_entries`, and `search_entries`.

**Recall (resurfacing):** Guardrails for a quiet, non-intrusive recall system are in `docs/recall-guardrails.md` (max one per session, cooldown, timing, frequency).

**Entry importance:** A lightweight, invisible score (pinned + edit count + open count) is used only as a small ranking boost in resurfacing and thought trail. No UI; see importance constants in `src-tauri/src/lib.rs`.

## Experimental / disabled features

**Voice capture** (macOS) is implemented but **disabled** in the main flow: it was too fragile and slow for the MVP. The code remains in place so it can return as an experimental feature later.

- **Backend:** `src-tauri/src/speech.rs` (SpeechManager, native recognition); command `run_native_speech_recognition`. Gated by `EXPERIMENTAL_VOICE_CAPTURE` in `src-tauri/src/lib.rs` (default `false`). When false, no voice shortcuts are registered and no speech thread runs at startup.
- **Frontend:** `src/features/entries/VoiceCaptureOverlay.tsx`; gated by `EXPERIMENTAL_VOICE_CAPTURE` in `src/App.tsx`. When false, Cmd+Shift+V and Alt+Space do not open the overlay.

To re-enable: set `EXPERIMENTAL_VOICE_CAPTURE` to `true` in both `lib.rs` and `App.tsx`.
