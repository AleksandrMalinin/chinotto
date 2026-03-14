# Recall guardrails

Chinotto’s recall (resurfacing, thought trail, search) must stay **quiet and non-intrusive**. This document defines the rules so recall never becomes noisy.

**Philosophy:** Capture first, structure later. Minimal interface. No recommendation feeds.

---

## 1. Recall guardrail rules

### 1.1 Maximum resurfaced entries

- **At most one** resurfaced entry is shown per app session.
- Once shown (or once we have “used” our one attempt), no further resurfacing until the next session.

### 1.2 Cooldown

- When an entry is resurfaced, it is recorded with the current time.
- That entry **must not** be resurfaced again for **at least 7 days**.
- The backend receives a list of entry IDs currently in cooldown; it never returns those IDs.

### 1.3 Do not show resurfacing when

Resurfacing is **not** attempted or shown when any of the following is true:

- The user is **actively typing** in the capture input (we only attempt at defined moments: app open or after save).
- **Search is open** (search UI visible or search query non-empty).
- An **entry is being edited** (edit mode active).

### 1.4 Timing (when we may show)

Resurfacing may **only** be attempted at these moments:

1. **On app open** – after the intro is dismissed and the main view is ready (stream loaded, no search, no selection, no edit).
2. **After the user saves an entry** – once per session, if we have not already shown a resurfaced entry this session.

We do **not** resurface on focus changes, on idle, or on arbitrary timers.

### 1.5 Frequency (silence is acceptable)

- The system **sometimes shows nothing** even when a candidate exists.
- A show probability (e.g. ~0.6–0.7) is applied when we have a result: we only display it that fraction of the time. The rest of the time we stay silent.
- Silence is acceptable and expected.

---

## 2. Session logic

- **Session:** One run of the app (from launch until quit). No persistent “session” id; we use a ref that resets on reload.
- **One shot per session:** A ref `triedResurfaceRef` is set to `true` when we **attempt** resurfacing (whether we show something or not). We only **show** at most one overlay per session; we only **attempt** at most twice per session: once on open, and optionally once after the next save if we didn’t show on open.
- **Flow:**
  1. App opens → intro → intro dismissed → conditions checked (no search, no selection, no edit, not already attempted). If OK, attempt resurface. If we get a result and pass the show probability, show it and mark session as “shown”. If we don’t show (no result or skipped by probability), we leave “attempted” true for the open path but do **not** set “shown”.
  2. User saves an entry. If we have not yet **shown** a resurfaced entry this session and conditions are OK, attempt resurface once. If we show, mark as shown. No further attempts this session.

So: **max one attempt on open**, **max one attempt after first save** (only if we didn’t show on open), **max one display per session**.

---

## 3. Cooldown strategy

- **Storage:** LocalStorage holds a small history of resurfaced entries: `{ id, shownAt }` (ISO timestamp). Cap at a reasonable size (e.g. 50) and drop oldest when over.
- **Cooldown window:** 7 days. Any entry whose `shownAt` is within the last 7 days is considered “in cooldown”.
- **Exclude list:** When calling the backend, we pass all entry IDs that are currently in cooldown. The backend excludes them from temporal recall and fallback.
- **On show:** When we display a resurfaced entry, we append `{ id, shownAt: now }` to the history and trim if over the cap.

---

## 4. Summary table

| Rule              | Implementation |
|-------------------|----------------|
| Max 1 per session | Ref: “shown this session”; only one overlay displayed. |
| Cooldown 7 days   | LocalStorage history with timestamps; exclude those IDs when calling backend. |
| No show when typing | Only attempt on open or after save, never on input focus or keypress. |
| No show when search open | Guard: `!isSearchOpen && search.trim() === ""`. |
| No show when editing | Guard: `editingEntryId === null`. |
| Timing: open or after save | Attempt once when conditions met after intro; optionally once after first save if not yet shown. |
| Sometimes nothing | Show probability applied when we have a candidate; otherwise stay silent. |
