# Privacy

Chinotto is **local-first**. Your thoughts stay on your device in a SQLite database. Capture and search work without any network connection.

## Your data

- **Entry text** is stored locally only. It is not sent to analytics or included in crash-style telemetry.
- **Export** — File → Export Entries… writes a ZIP of Markdown files you control.
- **Backup** — automatic local backups in `chinotto-backups/` (last 7 kept).

## Optional sync

When you enable sync and sign in with Apple, entries can sync with the Chinotto mobile app via Firebase. Sync is optional; the app remains fully usable without it.

## Analytics (opt-in)

Analytics are **off by default**. You can enable them in Settings → **Share anonymous usage data**.

When enabled, Chinotto sends only simple event names and numbers — for example “entry created” with the text length, or “search used” with the number of results. It never sends:

- the text of your thoughts
- your search query
- personal identifiers

Analytics help understand how the app is used. You can turn them off at any time in Settings.
