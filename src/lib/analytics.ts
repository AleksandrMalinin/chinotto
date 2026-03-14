/**
 * Minimal product analytics via Umami. Anonymous, opt-in, batched, non-blocking.
 * Never sends entry text, search queries, or identifiers. See docs/analytics-design.md.
 */

const STORAGE_KEY = "chinotto-analytics-enabled";
export const ANALYTICS_PROMPT_SHOWN_KEY = "chinotto-analytics-prompt-shown";
const BATCH_INTERVAL_MS = 30_000;
const BATCH_SIZE_MAX = 10;
const USER_AGENT = "Chinotto-Desktop/1.0";

export type AnalyticsEvent =
  | { event: "entry_created"; text_length: number }
  | { event: "search_used"; result_count?: number }
  | { event: "entry_opened" }
  | { event: "resurface_shown"; age_days: number }
  | { event: "resurface_opened"; age_days: number }
  | { event: "thought_trail_opened" };

type QueuedEvent = AnalyticsEvent & { ts: string };

let umamiBaseUrl: string | null = null;
let websiteId: string | null = null;
let sessionId: string | null = null;
let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function getStorage(): Storage | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

function getSessionId(): string {
  if (sessionId) return sessionId;
  sessionId = crypto.randomUUID();
  return sessionId;
}

export function isOptIn(): boolean {
  const storage = getStorage();
  if (!storage) return false;
  return storage.getItem(STORAGE_KEY) === "true";
}

export function setOptIn(enabled: boolean): void {
  const storage = getStorage();
  if (storage) storage.setItem(STORAGE_KEY, enabled ? "true" : "false");
}

export function getAnalyticsPromptShown(): boolean {
  const storage = getStorage();
  if (!storage) return false;
  return storage.getItem(ANALYTICS_PROMPT_SHOWN_KEY) === "true";
}

export function setAnalyticsPromptShown(): void {
  const storage = getStorage();
  if (storage) storage.setItem(ANALYTICS_PROMPT_SHOWN_KEY, "true");
}

function isEnabled(): boolean {
  return !!umamiBaseUrl && !!websiteId && isOptIn();
}

/**
 * Configure Umami. Call once at app init.
 * baseUrl: Umami instance root (e.g. https://cloud.umami.is or https://analytics.yoursite.com).
 * id: Website ID from your Umami dashboard.
 * If either is null/empty, analytics is disabled regardless of opt-in.
 */
export function setUmami(baseUrl: string | null, id: string | null): void {
  umamiBaseUrl = baseUrl?.trim() || null;
  websiteId = id?.trim() || null;
}

/** @deprecated Use setUmami(baseUrl, websiteId). Kept for compatibility. */
export function setEndpoint(url: string | null): void {
  if (!url?.trim()) {
    umamiBaseUrl = null;
    websiteId = null;
    return;
  }
  const u = new URL(url);
  const path = u.pathname.replace(/\/api\/send\/?$/, "");
  umamiBaseUrl = `${u.origin}${path}`;
  const id = u.searchParams.get("website") ?? u.searchParams.get("id");
  websiteId = id ?? null;
}

function eventToData(payload: QueuedEvent): Record<string, string | number> {
  const data: Record<string, string | number> = { ts: payload.ts };
  if ("text_length" in payload) data.text_length = payload.text_length;
  if ("age_days" in payload) data.age_days = payload.age_days;
  if ("result_count" in payload && payload.result_count !== undefined)
    data.result_count = payload.result_count;
  return data;
}

function sendToUmami(queued: QueuedEvent): void {
  if (!umamiBaseUrl || !websiteId) return;
  const { event } = queued;
  const data = eventToData(queued);
  const body = JSON.stringify({
    type: "event",
    payload: {
      website: websiteId,
      hostname: "Chinotto",
      url: "/",
      title: "Chinotto",
      referrer: "",
      language: typeof navigator !== "undefined" ? navigator.language : "en",
      screen: typeof screen !== "undefined" ? `${screen.width}x${screen.height}` : "0x0",
      name: event,
      data,
      id: getSessionId(),
    },
  });
  const url = `${umamiBaseUrl.replace(/\/$/, "")}/api/send`;
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body,
    keepalive: true,
  }).catch(() => {});
}

function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, BATCH_INTERVAL_MS);
}

function flush(): void {
  if (!isEnabled() || queue.length === 0) return;
  const batch = queue;
  queue = [];
  for (const event of batch) {
    sendToUmami(event);
  }
}

/**
 * Record an event. Fire-and-forget; never blocks. No-op when analytics is disabled or opt-out.
 * Only call with allowed event shapes (no text, no query, no identifiers).
 */
export function track(payload: AnalyticsEvent): void {
  if (!isEnabled()) return;
  queue.push({ ...payload, ts: new Date().toISOString() });
  if (queue.length >= BATCH_SIZE_MAX) {
    flush();
  } else {
    scheduleFlush();
  }
}
