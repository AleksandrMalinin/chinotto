# Privacy

Chinotto is **local-first**. Your thoughts stay on your device in a SQLite database. Capture and search work without any network connection.

## Your data

- **Entry text** is stored locally only. It is not sent to analytics or included in crash-style telemetry.
- **Export** — File → Export Entries… writes a ZIP of Markdown files you control.
- **Backup** — automatic local backups in `chinotto-backups/` (last 7 kept).

## Optional sync

When you enable sync and sign in with Apple, entries can sync with the Chinotto mobile app via Firebase. Recall themes can sync too when enabled on both devices. Sync is optional; the app remains fully usable without it.

## Optional sharing

When you create a share link from entry detail, Chinotto uploads a **snapshot** of the selected thoughts (text and share metadata you choose) to the hosted read service at `getchinotto.app`. The link expires after the period you pick. Your full local database is not uploaded. Sharing is explicit and optional.

## Analytics (opt-in)

Analytics are **off by default**. You can enable them in Settings → **Share anonymous usage data**.

When enabled, Chinotto sends only simple event names and numbers — for example “entry created” with the text length, or “search used” with the number of results. It never sends:

- the text of your thoughts
- your search query
- personal identifiers

Analytics help understand how the app is used. You can turn them off at any time in Settings.
