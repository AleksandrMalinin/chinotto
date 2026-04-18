# GitHub release notes (technical)

These sections feed the **GitHub Release** description in CI (see `.github/workflows/release.yml`). Use **factual / technical** bullets: short **topic label**, colon, then details (backticks for paths, crates, env names). **User-facing marketing copy** belongs on the website, not here.

Add **`## vX.Y.Z`** before you push tag **`vX.Y.Z`**.

## v1.3.1

* **Main window:** desktop `setup` ensures `main` is unminimized, visible, and focused after launch (`src-tauri/src/lib.rs`) — restores expected visibility after in-app updater relaunch on macOS
* **Empty onboarding / showcase:** `StreamFlowPanel` visuals clipped to panel bounds (`overflow: hidden`), softer blurred blobs and glass, tuned SVG stroke gradient stops (`src/index.css`, `src/components/StreamFlowPanel.tsx`); slightly reduced showcase card glow (`--chinotto-glow-*` under `.stream-showcase-overlay`)
* **Dev-only:** preview empty-stream onboarding without deleting data — `src/lib/devPreviewEmptyStream.ts`, `refresh()` short-circuit when flag set; Developer menu + header control in `App.tsx` (stripped in production builds)

## v1.3.0

* **Thought detail editing:** in-detail text editing on by default; debounced `update_entry` from `App.tsx`; continuation line break handling in `EntryDetail.tsx` (`beforeinput` / `setRangeText`); back-only exit from detail when editing
* **Persistence:** `entries.updated_at` column + migration in `src-tauri/src/db/mod.rs` / `schema.sql`; `update_entry_text` sets `text`, `updated_at`, and `edit_count`
* **Stream UI:** single-line row preview with ellipsis; domain badge omitted in stream row variant where applicable (`src/index.css`, `EntryStream.tsx`)
* **Analytics:** `entry_text_saved` with `source` (`detail` \| `stream`) and `text_length` after successful saves (`src/lib/analytics.ts`, `App.tsx`, `docs/analytics-design.md`)
* **Product chrome:** removed beta symbol from header (`App.tsx`, `src/index.css`)
* **Tests:** `update_entry_text` coverage in `src-tauri/src/db/mod.rs`

## v1.2.0

* **Menu bar tray polish:** improved capture popover stability by debouncing hide on focus loss and keeping main stream refresh behavior reliable after tray saves (`src/features/entries/TrayCapturePanel.tsx`, `src/App.tsx`)
* **Jump to date:** added calendar jump flow with `jump_dates_in_month` / `jump_anchor_for_local_date` commands, month dots for local dates with entries, and stream scroll-to-date in `src/features/entries/JumpToDatePopover.tsx`, `src/features/entries/entryApi.ts`, and `src/App.tsx`
* **Stream grouping:** replaced older catch-all grouping with per-day section headers (Today, Yesterday, and explicit calendar dates) in `src/features/entries/EntryStream.tsx`
* **Jump context UX:** added sticky right-aligned jump context with `Back to now`, auto-collapse label timing, and auto-clear when returning near top or switching modes (`src/App.tsx`, `src/lib/useJumpContextAutoClear.ts`, `src/index.css`)
* **Jump scroll polish:** aligned date-jump scrolling to section containers with explicit top offset via `src/lib/scrollJumpSectionIntoView.ts` and `.stream-section` `scroll-margin-top` in `src/index.css`; disabled jump-calendar click affordance for current day when already at stream top
* **Analytics:** added opt-in jump funnel events (`jump_to_date_calendar_opened`, `jump_to_date_completed` with `days_ago`, `jump_to_date_back_to_now`) and docs in `src/lib/analytics.ts` / `docs/analytics-design.md`
* **Tests:** added jump date coverage for scroll-dismiss logic and analytics day metric (`src/lib/jumpContextScroll.test.ts`, `src/lib/useJumpContextAutoClear.test.tsx`, `src/lib/jumpDateDaysAgoMetric.test.ts`) plus Rust DB tests for jump date commands

## v1.1.0

* **Menu bar tray:** added native tray integration in `src-tauri/src/tray_capture.rs` with left-click quick capture toggle and template icon handling on macOS
* **Quick capture popup:** shipped dedicated `capture-popover` UI (`src/features/entries/TrayCapturePanel.tsx`, `src/main.tsx`, `src/index.css`) as a compact single-row input with secondary open-app action
* **Platform wiring:** enabled tray/macOS private API features, added transparent popover window config in `src-tauri/tauri.conf.json`, and updated `core:window` permissions in `src-tauri/capabilities/default.json`

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
* **Icon / bundle:** Opaque full-canvas icon + optional Pillow flatten (`scripts/flatten_icon_png.py`, `scripts/generate-macos-app-icons.sh`); macOS `AppIcon.appiconset` / `icon.icns` (`docs/app-icon.md`); light `dmg-background.png` + `scripts/generate-dmg-background.py`; `bundle.macOS.dmg.background` in `tauri.conf.json`
* **Thought detail & copy:** Related-thoughts block hierarchy and empty state (**No connections yet**); back control; primary UI uses **thoughts** in aria/search/stream (`EntryDetail`, `EntryStream`, `SearchInput`, `searchOverlayFeedback.ts`); “Related thoughts” vs thought-trail docs alignment
* **Tooling / docs:** `.gitignore` `/target/` for repo-root Cargo output; `docs/github-release-notes.md` + `scripts/extract-release-notes.py` release-body flow; `docs/updater.md`; `fix-dmg-bundler` / `DMG_BUNDLING_FIX.md` (DMG script default name from `tauri.conf.json`)
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
