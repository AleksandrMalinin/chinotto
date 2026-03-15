/**
 * Minimal URL detection and hostname extraction for entry text.
 * No metadata fetching; used only for link rendering and domain badge.
 */

/** Matches http(s) URLs or www.-prefixed URLs (stops at whitespace or end). */
const URL_RE = /(https?:\/\/\S+)|(www\.\S+)/gi;

export type Segment = { type: "text"; value: string } | { type: "url"; value: string; href: string; hostname: string };

export interface ParsedEntry {
  segments: Segment[];
  /** Set when the entry contains exactly one URL and other text (badge hidden when entry is only the URL). */
  singleHostname: string | null;
}

function trimTrailingPunctuation(url: string): string {
  return url.replace(/[.,;:!?)]+$/, "");
}

function hrefForDisplay(url: string): string {
  const trimmed = trimTrailingPunctuation(url);
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function hostnameFromHref(href: string): string {
  try {
    const u = new URL(href);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function parseTextWithUrls(text: string): ParsedEntry {
  if (!text.trim()) {
    return { segments: [], singleHostname: null };
  }
  const segments: Segment[] = [];
  const urls: { href: string; hostname: string }[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, m.index) });
    }
    const raw = m[0];
    const href = hrefForDisplay(raw);
    const hostname = hostnameFromHref(href);
    if (hostname) {
      urls.push({ href, hostname });
      const displayValue = trimTrailingPunctuation(raw).replace(/^https?:\/\//i, "").replace(/^www\./i, "");
    segments.push({ type: "url", value: displayValue, href, hostname });
    } else {
      segments.push({ type: "text", value: raw });
    }
    lastIndex = m.index + raw.length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }
  const hasOtherText = segments.some((s) => s.type === "text" && s.value.trim() !== "");
  const singleHostname =
    urls.length === 1 && hasOtherText ? urls[0].hostname : null;
  return { segments, singleHostname };
}
