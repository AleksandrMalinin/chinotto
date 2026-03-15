<p align="center">
  <img src="docs/logo.svg" width="80" alt="Chinotto" />
</p>

# Chinotto

Capture first.  
Revisit later.

Chinotto is a minimal desktop thinking tool built for the moment a thought appears. Capture it instantly — without projects, folders, or workspaces.

Structure can come later, when you revisit.

Local-first. Desktop only. No cloud, no accounts, no sync.

## Run locally

Prerequisites: Node.js, Rust, and system dependencies for [Tauri 2](https://v2.tauri.app/start/prerequisites/).

```bash
npm install
npm run tauri dev
```

## Stack

- Tauri
- Rust
- React
- TypeScript
- SQLite
- Tailwind CSS

## Core behavior

- **Capture** — open the app and start typing
- **Stream** — entries appear in reverse chronological order
- **Search** — full-text search across entries (SQLite FTS5)
