# GitHub release notes (technical)

These sections feed the **GitHub Release** description in CI (see `.github/workflows/release.yml`). Use **factual / technical** bullets: short **topic label**, colon, then details (backticks for paths, crates, env names). **User-facing marketing copy** belongs on the website, not here.

Add **`## vX.Y.Z`** before you push tag **`vX.Y.Z`**.

## v1.0.0

* **Empty stream / onboarding:** `StreamFlowPanel` + progressive empty-stream onboarding in `EntryStream.tsx`; `hasEverSavedThought` / `streamOnboarding.ts`; capture `onDraftChange` wiring; intro gradient headline, proceed hint, press-any-key copy; design-system + recall guardrail doc updates
* **Search / catalog:** `entryCatalogPresence.ts` consolidates full-list load and search-trigger rules; hide inline ⌘K control when the catalog is empty; capture row layout stable when search UI toggles; search placeholder uses “thoughts” wording; tests for `getSearchFeedback` and shortcut visibility
* **Resurface:** `mayAttemptResurface` / session guards — resurface when the main view is ready (not tied to save); `docs/recall-guardrails.md` aligned; Rust `get_resurfaced_entry` reason copy softened (`temporal_reason_anchor`, `format_ago` → “From …” style)
* **Welcome preview:** `StreamShowcaseModal` replays welcome-style stream preview; links to manifesto / changelog; analytics `stream_showcase_opened`
* **UI:** Modal / showcase card glow tuned in `index.css`; header `chinotto-logo` hover styling; β only on header title, not on Settings footer line (`App.tsx`, `ChinottoCard.tsx`)
* **Shortcuts / keys:** `src/lib/keyboardLabels.ts` — `ENTER_KEY_GLYPH` (↵) in Settings (`ChinottoCard`) and empty onboarding hint; empty hint adds ⌘N / Ctrl+N (via `userAgent`) to focus capture; `Enter` a11y via `aria-label` / `title` where the glyph is used alone
* **Late edit:** `EntryStream` textarea `onBlur` ends late edit when focus leaves the row (discard like Esc) — fixes odd ⌘E / focus after double-click then click-away
* **Analytics:** `app_version` included on event payloads (`src/lib/analytics.ts`)
* **Tauri / Rust:** Unused `Db` query helpers removed from `src-tauri/src/db/mod.rs`; `thought_trail` compiled only under `#[cfg(test)]` in `lib.rs`; tests unchanged for recall / thought-trail ranking
* **Icon / bundle:** App icon safe-area padding + macOS asset catalog pipeline (`docs/app-icon.md`, `src-tauri/icons/macos/`)
* **Tooling / docs:** `.gitignore` `/target/` for repo-root Cargo output; `docs/github-release-notes.md` + `scripts/extract-release-notes.py` release-body flow; `docs/updater.md` and `DMG_BUNDLING_FIX.md` updates
* **Tests:** `streamOnboarding`, `EntryStream` empty onboarding branches, extended `mayAttemptResurface` cases

## v0.2.1

* **Updater:** `@tauri-apps/plugin-updater` + `plugin-process`, `check()` on prod launch, `UpdateNudge` UI; `tauri.conf.json` endpoints + minisign pubkey; `createUpdaterArtifacts` for signed bundles
* **CI:** `.github/workflows/release.yml` — tagged aarch64 macOS build, `TAURI_SIGNING_PRIVATE_KEY` required; optional Developer ID + App Store Connect API key for codesign/notarization; `workflow_dispatch` for manual runs
* **Release packaging:** release body from `docs/github-release-notes.md` via `scripts/extract-release-notes.py`; stable download asset `Chinotto_macOS_aarch64.dmg` uploaded alongside versioned DMG (`docs/updater.md`)

## v0.2.0

* **Quick capture & feedback:** global shortcut (⌘⇧K), in-app feedback entry
* **Entries stream:** hide empty-state when only pinned entries are present
* **Settings:** edit shortcut listed on shortcuts screen
* **Entries interaction:** double-click prefers edit over open
* **Settings UI:** shortcut tile hover contrast
* **Release & docs:** version 0.2.0 bump; macOS signing/notarization guide + `docs/release-macos` gitignore churn

## v0.1.0

* **Initial macOS build:** capture, reverse-chronological stream, SQLite + FTS search, minimal shell
