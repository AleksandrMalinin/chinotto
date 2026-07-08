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
- **Slice 2 (planned):** upload snapshot to share service; copy `https://getchinotto.app/t/{token}`.

---

## Slice 1 (shipped in repo)

| Piece | Location |
|-------|----------|
| `share_threads` table | `src-tauri/src/db/schema.sql`, migration in `mod.rs` |
| Commands | `create_share_thread`, `list_share_threads`, `revoke_share_thread`, `get_share_thread`, `write_utf8_file` |
| HTML builder | `src/lib/shareThreadHtml.ts` |
| API wrappers | `src/features/entries/shareThreadApi.ts` |
| Upload client | `src/lib/shareThreadUpload.ts` (POST snapshot after create) |
| UI | `src/features/entries/ShareThreadDialog.tsx`, entry from `EntryDetail` |
| Link constant | `CHINOTTO_SHARE_BASE_URL`, `CHINOTTO_SHARE_API_BASE` in `src/lib/chinottoLinks.ts` |

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

## Slice 2 (in progress)

**Desktop (repo):** after create, POST pre-rendered HTML to share API (`publishShareThreadSnapshot`). On failure, user still gets local HTML + copied link.

**Hosted service (separate deploy):** `chinotto-web` — Vercel serverless under `api/` + `share/`; see `chinotto-web/docs/share-hosting.md`.

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/threads` | POST | Store `{ token, html, expiresAt, contextNote? }` |
| `/t/{token}` | GET | Serve HTML; `noindex`; 404 if missing, expired, or revoked |
| `/api/threads/{token}` | DELETE | Remove snapshot (revoke) |

Payload (POST body, camelCase JSON):

```json
{
  "token": "uuid-v4",
  "html": "<!DOCTYPE html>…",
  "expiresAt": "2026-07-08T12:00:00Z",
  "contextNote": "optional one line"
}
```

- Response **201** on create; **204** on delete; **404** when read/revoke misses.
- Retention: delete row at or before `expiresAt` (cron or TTL store).
- Dev override: `VITE_CHINOTTO_SHARE_API_BASE` (e.g. local stub).

Until the service ships, POST fails gracefully and Slice 1 HTML handoff still works.

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
| 2026-06 | Slice 2 client: POST HTML to `/api/threads` after create |
