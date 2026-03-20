# GitHub release notes (technical)

These sections feed the **GitHub Release** description in CI (see `.github/workflows/release.yml`). Use **factual / technical** bullets: short **topic label**, colon, then details (backticks for paths, crates, env names). **User-facing marketing copy** belongs on the website, not here.

Add **`## vX.Y.Z`** before you push tag **`vX.Y.Z`**.

## v0.2.1

* Tauri v2 updater: `@tauri-apps/plugin-updater` + `plugin-process`, `check()` on prod launch, `UpdateNudge` UI; `tauri.conf.json` endpoints + minisign pubkey; `createUpdaterArtifacts` for signed bundles
* CI: `.github/workflows/release.yml` — tagged aarch64 macOS build, `TAURI_SIGNING_PRIVATE_KEY` required; optional Developer ID + App Store Connect API key for codesign/notarization; `workflow_dispatch` for manual runs
* Release body from `docs/github-release-notes.md` via `scripts/extract-release-notes.py`; stable download asset `Chinotto_macOS_aarch64.dmg` uploaded alongside versioned DMG (`docs/updater.md`)

## v0.2.0

* Quick capture & feedback: global shortcut (⌘⇧K), in-app feedback entry
* Entries stream: hide empty-state when only pinned entries are present
* Settings: edit shortcut listed on shortcuts screen
* Entries interaction: double-click prefers edit over open
* Settings UI: shortcut tile hover contrast
* Release & docs: version 0.2.0 bump; macOS signing/notarization guide + `docs/release-macos` gitignore churn

## v0.1.0

* Initial macOS build: capture, reverse-chronological stream, SQLite + FTS search, minimal shell
