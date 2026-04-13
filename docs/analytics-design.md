# Product analytics

The project uses **Umami** (self-hosted or [Umami Cloud](https://umami.is)) for lightweight, privacy-first analytics. No user content, search queries, or identifiers are sent. Opt-in only.

**Setup:** Run Umami outside this repo (Docker or Umami Cloud). [Add a website](https://umami.is/docs/add-a-website) with domain `Chinotto` and use its website ID in the client.

## Privacy rules

- **Never collect or send:** entry text, search queries, personal identifiers.
- **Anonymous only:** no user IDs, no IP-based fingerprinting in our payloads (provider may add platform metadata).
- **Opt-in:** analytics disabled by default; user must enable in settings.

## Events (allowed payloads)

Canonical list: **`AnalyticsEvent`** in `src/lib/analytics.ts`.

| Event                  | Allowed properties   | When sent |
|------------------------|----------------------|-----------|
| `entry_created`       | `text_length` (number) | User creates an entry |
| `first_entry_created` | `text_length` (number) | User creates their first ever entry |
| `entry_deleted`       | (none)               | User deletes an entry |
| `entry_pinned`        | (none)               | User pins an entry |
| `search_used`         | `result_count` (optional) | User selects an entry from search results |
| `settings_opened`     | (none)               | User opens Settings (Chinotto Card) |
| `stream_showcase_opened` | (none)            | User opens welcome screen preview (header title; DB has entries) |
| `entry_opened`        | (none)               | User opens an entry (detail view) |
| `resurface_shown`     | `age_days` (number)  | Resurface overlay is shown |
| `resurface_opened`    | `age_days` (number)  | User opens entry from resurface overlay |
| `thought_trail_opened` | (none)              | User views an entry that has a thought trail |
| `jump_to_date_calendar_opened` | (none)    | User opens the jump-to-date calendar popover |
| `jump_to_date_completed` | `days_ago` (number) | User picks a date and scroll succeeds (local-calendar days before today; no date string) |
| `jump_to_date_back_to_now` | (none)        | User clicks “Back to now” after a jump |
| `entry_text_saved`    | `source` (`"detail"` \| `"stream"`), `text_length` (number) | Persisted text edit succeeds (detail debounced save or stream inline save) |

**On every event**, Umami `data` also includes `ts` (ISO timestamp) and `app_version` (semver string from `package.json` at build time) so you can segment by release. No other properties beyond the table above and those two. No free-form strings that could contain user content.

---

## Implementation overview

- **Opt-in:** Stored in `localStorage` under a single key (e.g. `chinotto-analytics-enabled`). Default `false`. A settings screen or first-run prompt can call `analytics.setOptIn(true)`. When `false`, the client no-ops (no enqueue, no send).
- **Batching:** Events are queued in memory and flushed on a timer (every 30s) or when queue size reaches 10. Each event is sent as one POST to Umami's `/api/send`.
- **Non-blocking:** `track()` only enqueues; flush runs in the background. No `await` in UI code. Failed sends are caught and discarded (no retry, no user-visible error).
- **Disable completely:** If `analytics.setOptIn(false)` or no endpoint is configured, the client never sends. Build flag or env can leave the endpoint empty in builds where analytics must be off.

---

## Integration points (where to call `track`)

| Event                 | Where to call |
|-----------------------|---------------|
| `entry_created`       | After `createEntry(text)` succeeds; pass `text.length` only. |
| `search_used`         | When executing search (e.g. when `loadEntries(search)` is called with non-empty `search.trim()`). Do not send the query. |
| `entry_opened`        | When user opens an entry (e.g. alongside `recordEntryOpen(entry.id)`). No entry id in payload. |
| `resurface_shown`     | When resurfaced overlay is shown (when `setResurfaced(r)` is called with non-null). Compute `age_days` from `entry.created_at`. |
| `resurface_opened`    | When user clicks to open from resurfaced overlay (`onOpen(entry)`). Same `age_days`. |
| `thought_trail_opened`| When entry detail (thought trail) is opened, e.g. when `EntryDetail` mounts for an entry. |
| `jump_to_date_calendar_opened` | When `JumpToDatePopover` opens (`open` becomes true). |
| `jump_to_date_completed` | After `jump_anchor_for_local_date` returns an id, before scroll; `days_ago` via `jumpDateDaysAgoMetric(ymd)`. |
| `jump_to_date_back_to_now` | Start of `handleJumpBackToNow` in `App.tsx`. |
| `entry_text_saved`      | After `updateEntry` succeeds: `source: "detail"` when the debounced detail draft matched the saved body; `source: "stream"` in `handleEntryUpdate` after stream inline edit. |

All calls must be fire-and-forget; never block the UI or depend on analytics for app logic.

---

## Client usage (`src/lib/analytics.ts`)

- **Init:** Call `setUmami(baseUrl, websiteId)` once at app startup. Use Umami Cloud or your self-hosted URL (no trailing slash). In Umami: add a website with **Name** e.g. "Chinotto Desktop" and **Domain** a valid domain (e.g. `chinotto.app`); Umami requires a domain-style value. The client sends that same hostname so events are accepted. Copy the Website ID and set `VITE_UMAMI_WEBSITE_ID`. Example: `setUmami(import.meta.env.VITE_UMAMI_URL ?? null, import.meta.env.VITE_UMAMI_WEBSITE_ID ?? null)`.
- **Track:** `track({ event: "entry_created", text_length: text.length })` etc. Never `await`; never pass text or query.
- **Opt-in:** `isOptIn()` / `setOptIn(enabled)` read/write `localStorage`. Default is off.
- **Disable completely:** Do not call `setUmami`, or call `setUmami(null, null)`. Then no events are sent regardless of opt-in.

The client sends each event to Umami's `POST /api/send` with `type: "event"` and a payload containing `website`, `hostname` ("chinotto.app", must match the Domain configured in Umami), `url` ("/desktop"), `name` (event name), and `data` (event-specific props plus `ts` and `app_version`). One HTTP request per event when the batch flushes; requests are fire-and-forget. Umami requires a `User-Agent` header. **Umami Cloud returns `{"beep":"boop"}` and does not register events when it flags the request as a bot** (e.g. custom app User-Agent); the client sends a browser-like User-Agent so events are accepted.
