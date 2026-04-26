<p align="center">
  <img src="docs/logo.svg" width="80" alt="Chinotto" />
</p>

# Chinotto

*Capture first.  
Revisit later.*

Chinotto is a minimal desktop thinking tool built for the moment a thought appears.  
Capture it instantly — without projects, folders, or workspaces.

Structure can come later — when you revisit.

Local-first. Desktop only. Optional **device sync** with the mobile app via Firebase (Sign in with Apple) when you configure env vars — see `docs/sync.md`.

Your entries stay local; analytics never include thought text.  
Export them anytime.

## Run locally

Prerequisites: Node.js, Rust, and system dependencies for [Tauri 2](https://v2.tauri.app/start/prerequisites/).

**macOS builds**

| Goal | Command / script |
|------|-------------------|
| Local dev | `npm run tauri dev` |
| Ad-hoc `.app` (opens from disk; **no** native Sign in with Apple) | `npm run build:macos-app` → runs `scripts/sign-macos.sh` |
| Team-signed `.app` + **`builds/Chinotto-native.app`** (native SIWA; needs Xcode provisioning profiles for `app.chinotto`) | `npm run build:macos-app:native` → `scripts/codesign-macos-dev.sh` |
| **TestFlight / Mac App Store** `.pkg` | `scripts/build-mas-testflight.sh` after `scripts/mas-testflight-env.sh` — see **`docs/macos-testflight.md`** |
| Developer ID + notarize (outside store) | `./scripts/build-release-macos.sh` — see [Tauri macOS signing](https://v2.tauri.app/distribute/sign/macos/) and `docs/release-macos.md` if you keep it |

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
- **Detail** — open an entry to continue the thought
- **Search** — full-text search across entries
- **Jump to date** — small calendar to scroll the stream to a remembered day (same stream, not a filtered mode)

**Data ownership**

- **Export** — entries can be exported as Markdown
- **Backup** — automatic local backups

## Updates

In-app updates use GitHub Releases (`latest.json`). Configure signing and CI secrets per [docs/updater.md](docs/updater.md).

## Related

- [Chinotto web](https://github.com/AleksandrMalinin/chinotto-web) — web companion / info site
