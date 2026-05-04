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

## Download (macOS)

**App Store:** [Chinotto](https://apps.apple.com/us/app/chinotto/id6761345307) — one listing for iPhone and Mac (Apple’s web preview is phone-first). On Mac, install from the App Store app or use menu **Chinotto → View on Mac App Store…** inside Chinotto.

## Run locally

Prerequisites: Node.js, Rust, and system dependencies for [Tauri 2](https://v2.tauri.app/start/prerequisites/).

```bash
npm install
npm run tauri dev
```

This repo is **source code** for the desktop app. End users install from the App Store (above). Shipping binaries is a maintainer concern and follows normal [Tauri macOS distribution](https://v2.tauri.app/distribute/macos/) tooling — not documented here.

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
