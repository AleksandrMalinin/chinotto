# Sharing — implementation

Companion to [sharing-proposal.md](sharing-proposal.md). Tracks what is built in `chinotto-app` vs planned hosted read URLs.

---

## Architecture (target)

```
Desktop (SQLite)                    Hosted read (future)
─────────────────                   ────────────────────
share_threads table        ──►      GET /t/{token}
  token, entry_ids,               Static/edge page
  context_note,                     renders thread HTML
  expires_at, revoked_at            noindex, HTTPS
```

- **Local-first:** entries stay authoritative on device; share is an explicit snapshot.
- **Slice 1 (current):** registry in SQLite + **self-contained HTML** file for preview and handoff (AirDrop, email attachment) until hosted read ships.
- **Slice 2 (planned):** upload snapshot to share service; copy `https://share.chinotto.app/t/{token}`.

---

## Slice 1 (shipped in repo)

| Piece | Location |
|-------|----------|
| `share_threads` table | `src-tauri/src/db/schema.sql`, migration in `mod.rs` |
| Commands | `create_share_thread`, `list_share_threads`, `revoke_share_thread`, `get_share_thread`, `write_utf8_file` |
| HTML builder | `src/lib/shareThreadHtml.ts` |
| API wrappers | `src/features/entries/shareThreadApi.ts` |
| UI | `src/features/entries/ShareThreadDialog.tsx`, entry from `EntryDetail` |
| Link constant | `CHINOTTO_SHARE_BASE_URL` in `src/lib/chinottoLinks.ts` |

### Limits

- Max **15** entries per thread
- Expiry **7 / 14 / 30** days (default 14)
- Token: UUID v4 (unguessable)
- Revoked or expired threads rejected on read/export

### Creator flow (Slice 1)

1. Entry detail → **Share thread…**
2. Select thoughts (current + thought trail entries, deduped)
3. Optional context note, pick expiry
4. **Create** → row in `share_threads`
5. Save **HTML preview** (save dialog) + copy **future link** to clipboard

Hosted URL is copied for convenience; until Slice 2, recipient uses the HTML file or waits for hosting.

### HTML preview

Standalone file, embedded CSS aligned with in-app readable plain text (paragraphs, bullets, blockquotes, continuation blocks). Opens in any browser; no Chinotto install.

---

## Slice 2 (planned)

- Upload thread payload to share backend (minimal JSON + entries)
- Public read route serves same HTML template
- Revoke/delete remote copy on revoke
- `noindex`, TLS, retention = expiry

Optional: reuse Firebase project only if it fits retention/security; otherwise dedicated share service.

---

## Slice 3 (planned, product V2/V3)

- **Reflection:** recipient text stored against `token`, visible to sharer in app
- **Append:** sharer adds entries to existing thread; recipient sees update banner

---

## Commands (Tauri)

| Command | Purpose |
|---------|---------|
| `create_share_thread` | `{ entryIds, contextNote?, expiresInDays? }` → `{ token, expiresAt }` |
| `get_share_thread` | Load metadata; `null` if missing, expired, or revoked |
| `list_share_threads` | Active threads for settings/revoke UI (later) |
| `revoke_share_thread` | Set `revoked_at` |
| `write_utf8_file` | Write generated HTML to user-chosen path |

---

## Privacy (implementation)

- No share data in analytics
- No automatic share on sync
- Spaces **not** included in share payload (entry text + timestamps only)
- User must confirm create; copy explains expiry

---

## Tests

- Rust: `create_share_thread` validation, expiry, revoke
- TS: `shareThreadHtml` escape + structure

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06 | Slice 1: local `share_threads`, HTML export, Share thread dialog |
