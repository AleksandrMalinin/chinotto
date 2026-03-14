# Minimal product analytics (design)

Lightweight, privacy-first analytics for Chinotto via **Umami**. No user content, no search queries, no identifiers. Opt-in only.

**Umami setup:** Install and run Umami **outside this repo** (separate directory, Docker, or [Umami Cloud](https://umami.is)). [Installation](https://umami.is/docs/install); then [add a website](https://umami.is/docs/add-a-website) with domain `Chinotto` and use its website ID in the client.

## Privacy rules

- **Never collect or send:** entry text, search queries, personal identifiers.
- **Anonymous only:** no user IDs, no IP-based fingerprinting in our payloads (provider may add platform metadata).
- **Opt-in:** analytics disabled by default; user must enable in settings.

## Events (allowed payloads)

| Event               | Allowed properties   | Example |
|---------------------|----------------------|---------|
| `entry_created`     | `text_length` (number) | `{ event: "entry_created", text_length: 42 }` |
| `search_used`       | (none or `result_count`) | `{ event: "search_used" }` |
| `entry_opened`      | (none)               | `{ event: "entry_opened" }` |
| `resurface_shown`   | `age_days` (number)  | `{ event: "resurface_shown", age_days: 3 }` |
| `resurface_opened`  | `age_days` (number)  | `{ event: "resurface_opened", age_days: 3 }` |
| `thought_trail_opened` | (none)            | `{ event: "thought_trail_opened" }` |

No other properties. No free-form strings that could contain content.

---

## Recommended tools (2–3 options)

### 1. **Umami** (self-hosted or Umami Cloud)

- **What:** Open-source, privacy-focused analytics. Custom events via JS `umami.track(name, data)` or direct POST to their API.
- **Pros:** You own the data when self-hosted; no vendor lock-in; free when self-hosted; simple event model; can run on Railway, Fly.io, or a small VPS.
- **Cons:** You operate the backend (or pay Umami Cloud); need to expose an endpoint for the desktop app (no script tag).
- **Fit:** Best when you want full control and zero recurring cost. Use Events API from the TypeScript client (POST from Tauri/React).

### 2. **TelemetryDeck**

- **What:** Privacy-first analytics for apps (iOS, macOS, Android, web). Anonymization on device; no cookies; built for indie/small teams.
- **Pros:** No infra; JS/TypeScript SDK with batching; privacy-by-design; stable; low maintenance.
- **Cons:** Third-party service; pricing (check current plans); less control over raw data.
- **Fit:** Best for “zero infra, just works” and strong privacy positioning. Use `@telemetrydeck/sdk` from the TypeScript client.

### 3. **Plausible (Events API)**

- **What:** Lightweight, privacy-friendly web analytics with a server-side/custom Events API.
- **Pros:** Mature, stable, clear privacy story; Events API works from desktop apps.
- **Cons:** Oriented to pageviews + goals; custom events are secondary; paid from the first tier.
- **Fit:** Reasonable if you already use or prefer Plausible; use Events API with a dedicated “desktop” domain or property.

---

## Trade-offs

| Criteria        | Umami (self-hosted) | TelemetryDeck | Plausible |
|----------------|----------------------|---------------|-----------|
| Cost           | Free (your infra)    | Paid tier     | Paid      |
| Maintenance    | You maintain server  | None          | None      |
| Data ownership | Full                 | Their infra   | Their infra |
| Reliability    | Depends on your host | Their SLA     | Known stable |
| Setup          | Backend + API        | SDK + app ID  | API key + domain |
| Desktop-friendly | Yes (POST API)    | Yes (JS SDK)  | Yes (Events API) |

---

## Recommendation for Chinotto (indie desktop)

**First choice: Umami (self-hosted)** if you’re willing to run one small service (e.g. Umami on Railway/Fly.io with their default Postgres). You get full control, no PII, and no recurring analytics cost. The TypeScript client below is built to POST batched events to an endpoint you control; point it at your Umami instance’s event API.

**Alternative: TelemetryDeck** if you prefer zero infra and are fine with a paid plan. Use their JS SDK; replace the “generic POST” in the client with TelemetryDeck’s `TelemetryDeck.start()` and `TelemetryDeck.signal()`, and keep the same event names and payload rules (no content, no identifiers).

**Avoid:** Heavy platforms (Mixpanel, Amplitude, Segment) and PostHog (per your reliability concern). Keep the event set small and the client minimal.

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

All calls must be fire-and-forget; never block the UI or depend on analytics for app logic.

---

## Client usage (`src/lib/analytics.ts`)

- **Init:** Call `setUmami(baseUrl, websiteId)` once at app startup. Use Umami Cloud (`https://cloud.umami.is`) or your self-hosted URL (no trailing slash). In Umami: add a website with **Name** e.g. "Chinotto Desktop" and **Domain** `Chinotto` (must match the hostname the client sends). Copy the website ID from the dashboard and pass it as `websiteId`. Example: `setUmami(import.meta.env.VITE_UMAMI_URL ?? null, import.meta.env.VITE_UMAMI_WEBSITE_ID ?? null)`.
- **Track:** `track({ event: "entry_created", text_length: text.length })` etc. Never `await`; never pass text or query.
- **Opt-in:** `isOptIn()` / `setOptIn(enabled)` read/write `localStorage`. Default is off.
- **Disable completely:** Do not call `setUmami`, or call `setUmami(null, null)`. Then no events are sent regardless of opt-in.

The client sends each event to Umami's `POST /api/send` with `type: "event"` and a payload containing `website`, `hostname` ("Chinotto"), `name` (event name), and `data` (event-specific props + `ts`). One HTTP request per event when the batch flushes; requests are fire-and-forget. Umami requires a `User-Agent` header (the client sends `Chinotto-Desktop/1.0`).
