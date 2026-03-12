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
