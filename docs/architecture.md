# Chinotto – Architecture

## Stack

- **Tauri 2:** Desktop shell; small binary, system WebView, Rust backend.
- **React + TypeScript:** UI; Vite for dev and build.
- **SQLite:** Local storage; one file per app instance, no server.
- **SQLite FTS5:** Full-text search over entries.

## Testing

- **Rust:** `cargo test` (built-in harness). Unit tests live in `#[cfg(test)] mod tests` under `src-tauri/src/`; optional integration-style tests use in-memory SQLite where needed.
- **TypeScript:** **Vitest** for `src/**/*.test.{ts,tsx}` (node environment; `@testing-library/react` where used). A few pure modules use **Node’s built-in test runner** via `node --import tsx --test` (see `package.json` → `test:ts`).
- **Commands:** `npm test` runs `test:rs` then `test:ts`. No Playwright/Cypress; Tauri `invoke` is not exercised in automated tests.

Rationale, layout, and coverage targets: **`docs/testing-strategy.md`**.

## Updates

- **In-app updates:** `tauri-plugin-updater` and `tauri-plugin-process` (check on launch in production builds; minimal bottom-left nudge). Metadata and signed update bundles come from **GitHub Releases** via `latest.json` (endpoint in `src-tauri/tauri.conf.json`). Release builds require `TAURI_SIGNING_PRIVATE_KEY` matching the embedded public key; see `docs/updater.md`. Tag push `v*` runs `.github/workflows/release.yml` (Apple Silicon target by default). Optional **Developer ID + notarization** in CI via Apple certificate and App Store Connect API secrets (same doc).
- **Release copy:** GitHub Release descriptions are **technical** (`docs/github-release-notes.md`, composed in CI). **User-oriented** release messaging is maintained on the **website**, not in that file.

## Why Tauri

- Desktop-only target; no need for a full browser or Electron’s weight.
- Rust backend for safe, fast access to SQLite and the filesystem.
- Single binary (plus system WebView) and straightforward distribution.

## Why SQLite

- Local-first: no network, no auth, no sync in MVP. Entry content never leaves the device.
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

**Empty stream onboarding:** Progressive UI when the main stream has no entries. State and triggers live in `src/App.tsx`; empty layout and motion in `src/features/entries/EntryStream.tsx`; draft callbacks in `src/features/entries/EntryInput.tsx`; trail panel in `src/components/StreamFlowPanel.tsx`. First-time vs “empty again” uses `src/lib/streamOnboarding.ts` (`localStorage` key `chinotto.hasEverSavedThought`). Product behavior: **`docs/product-spec.md`** → *Empty stream onboarding*.

**Search:** FTS5 virtual table `entries_fts` is kept in sync with `entries` via triggers (insert, update, delete). Search uses prefix matching (partial words match), case-insensitive FTS, and results are ordered by BM25 relevance. If FTS returns no rows, a case-insensitive substring (LIKE) fallback is used. The overlay shows result count, highlights matches, and supports Enter (open selected/first) and Escape (close and focus capture input).

**Related entries:** Shown on entry detail; computed by embedding cosine similarity (not FTS). Entries are embedded on save (AllMiniLML6V2); `find_similar_entries` returns the top-N by similarity. Root cause of noisy results was *no minimum score*: the top-N included weak matches (e.g. 0.2–0.4 similarity). We now require `cosine_similarity >= 0.5` so only clearly related entries are shown; if none pass, the block shows “None yet.” Normal search is unchanged (FTS only).

**Recall (resurfacing):** Guardrails for a quiet, non-intrusive recall system are in `docs/recall-guardrails.md` (max one per session, cooldown, timing, frequency).

**Entry importance:** A lightweight, invisible score (pinned + edit count + open count) is used only as a small ranking boost in resurfacing and thought trail. No UI; see importance constants in `src-tauri/src/lib.rs`.

## Experimental / disabled features

**Voice capture** (macOS) is implemented but **disabled** in the main flow: it was too fragile and slow for the MVP. The code remains in place so it can return as an experimental feature later.

- **Backend:** `src-tauri/src/speech.rs` (SpeechManager, native recognition); command `run_native_speech_recognition`. Gated by `EXPERIMENTAL_VOICE_CAPTURE` in `src-tauri/src/lib.rs` (default `false`). When false, no voice shortcuts are registered and no speech thread runs at startup.
- **Frontend:** `src/features/entries/VoiceCaptureOverlay.tsx`; gated by `EXPERIMENTAL_VOICE_CAPTURE` in `src/App.tsx`. When false, Cmd+Shift+V and Alt+Space do not open the overlay.

To re-enable: set `EXPERIMENTAL_VOICE_CAPTURE` to `true` in both `lib.rs` and `App.tsx`.
