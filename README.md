# Chinotto

Chinotto is a minimal desktop thinking tool for instantly capturing thoughts and recovering context later. It is designed for people who deal with a lot of information, flows, decisions, and ideas every day, and need a simple place to dump thoughts without organizing them up front.

**Philosophy:** capture first, structure later — no workspace overhead, no document mindset, no manual organization at write time.

## Run locally

**Prerequisites:** Node.js, Rust, and system deps for [Tauri 2](https://v2.tauri.app/start/prerequisites/).

```bash
npm install
npm run tauri dev
```

The app opens as a desktop window. The input is focused on launch; type and press **Enter** to create an entry. Use the search box to search across entries.

## MVP scope

- **Capture:** Open app → input focused → type → Enter creates a new entry.
- **Stream:** Entries shown in reverse chronological order (newest first).
- **Search:** Full-text search across entries (SQLite FTS5).

Desktop only, local-first, single-user. No sync, auth, cloud, pages, folders, documents, or extra product concepts.
