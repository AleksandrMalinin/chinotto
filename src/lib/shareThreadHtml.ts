import type { Entry } from "../types/entry";
import {
  parseReadablePlainText,
  type ReadableBlock,
  type ReadableLine,
} from "./readablePlainText";

export type ShareThreadHtmlInput = {
  contextNote?: string;
  expiresAt: string;
  entries: Entry[];
  relatedEntries?: Entry[];
};

const CHINOTTO_SITE_URL = "https://getchinotto.app";

function chinottoLogoSvg(size = 28): string {
  return `<svg class="brand-logo" width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="32" cy="32" r="22" stroke="currentColor" stroke-width="2" fill="none"/>
  <circle cx="32" cy="23" r="5" fill="currentColor"/>
  <circle cx="24" cy="34" r="4" fill="currentColor"/>
  <circle cx="40" cy="34" r="4" fill="currentColor"/>
  <circle cx="32" cy="41" r="3" fill="currentColor"/>
</svg>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const URL_RE = /(https?:\/\/\S+)|(www\.\S+)/gi;

function linkifyHtml(text: string): string {
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text)) !== null) {
    if (m.index > last) {
      out += escapeHtml(text.slice(last, m.index));
    }
    const raw = m[0].replace(/[.,;:!?)]+$/, "");
    const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    out += `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${escapeHtml(raw)}</a>`;
    last = m.index + m[0].length;
  }
  out += escapeHtml(text.slice(last));
  return out;
}

function renderLine(line: ReadableLine): string {
  const cls = line.isQuestion ? ' class="readable-question"' : "";
  return `<span${cls}>${linkifyHtml(line.text)}</span>`;
}

function renderBlocks(blocks: ReadableBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "list") {
        const items = block.items
          .map((item) => `<li>${renderLine(item)}</li>`)
          .join("");
        return `<ul class="readable-list">${items}</ul>`;
      }
      if (block.type === "blockquote") {
        const lines = block.lines
          .map((line) => `<p class="readable-blockquote-line">${renderLine(line)}</p>`)
          .join("");
        return `<blockquote class="readable-blockquote">${lines}</blockquote>`;
      }
      const lines = block.lines
        .map((line, i) =>
          i > 0 ? `<br />${renderLine(line)}` : renderLine(line)
        )
        .join("");
      return `<p class="readable-p">${lines}</p>`;
    })
    .join("");
}

function formatCompactTimestamp(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} · ${time}`;
}

function relativeBeatLabel(
  currentIso: string,
  previousIso: string | null
): string | null {
  if (!previousIso) return null;
  const deltaMs =
    new Date(currentIso).getTime() - new Date(previousIso).getTime();
  if (deltaMs <= 0) return null;
  const days = Math.round(deltaMs / 86_400_000);
  if (days > 0) {
    return days === 1 ? "1 day later" : `${days} days later`;
  }
  const hours = Math.round(deltaMs / 3_600_000);
  if (hours > 0) {
    return hours === 1 ? "1 hour later" : `${hours} hours later`;
  }
  const minutes = Math.round(deltaMs / 60_000);
  if (minutes > 0) {
    return minutes === 1 ? "1 minute later" : `${minutes} minutes later`;
  }
  return "moments later";
}

function beatTimestamp(currentIso: string, previousIso: string | null): string {
  const stamp = formatCompactTimestamp(currentIso);
  const rel = relativeBeatLabel(currentIso, previousIso);
  return rel ? `${stamp} · ${rel}` : stamp;
}

function formatRelatedStamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const withYear = d.getFullYear() !== now.getFullYear();
  const date = d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" as const } : {}),
  });
  const time = d.toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} · ${time}`;
}

function relatedEntryIsCompact(entry: Entry): boolean {
  const from = entry.continuation_from;
  if (from != null && from > 0 && from <= entry.text.length) return false;
  const text = entry.text.trim();
  if (!text || text.includes("\n")) return false;
  const blocks = parseReadablePlainText(text);
  if (blocks.length !== 1 || blocks[0].type !== "paragraph") return false;
  return blocks[0].lines.length === 1;
}

function renderRelatedEntry(entry: Entry): string {
  const stamp = escapeHtml(formatRelatedStamp(entry.created_at));
  const dt = escapeHtml(entry.created_at);
  if (relatedEntryIsCompact(entry)) {
    const block = parseReadablePlainText(entry.text)[0]!;
    const snippet =
      block.type === "paragraph" ? renderLine(block.lines[0]!) : "";
    return `      <li class="related-entry">
        <p class="related-line">
          <time class="related-when" datetime="${dt}">${stamp}</time><span class="related-snippet">${snippet}</span>
        </p>
      </li>`;
  }
  const body = renderEntryBody(entry);
  return `      <li class="related-entry related-entry--full">
        <time class="related-when" datetime="${dt}">${stamp}</time>
        ${body}
      </li>`;
}

function renderEntryBody(entry: Entry): string {
  const from = entry.continuation_from;
  const hasContinuation =
    from != null && from > 0 && from <= entry.text.length;
  if (!hasContinuation) {
    return `<div class="readable">${renderBlocks(parseReadablePlainText(entry.text))}</div>`;
  }
  const primary = entry.text.slice(0, from);
  const secondary = entry.text.slice(from).replace(/^\n/, "");
  let html = `<div class="readable">${renderBlocks(parseReadablePlainText(primary))}</div>`;
  if (secondary.trim()) {
    const label = entry.continuation_at
      ? `<p class="readable-continuation-label">Added ${escapeHtml(formatCompactTimestamp(entry.continuation_at))}</p>`
      : "";
    html += `<section class="readable-continuation">${label}<div class="readable">${renderBlocks(parseReadablePlainText(secondary))}</div></section>`;
  }
  return html;
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dateRangeLabel(entries: Entry[]): string {
  if (entries.length === 0) return "";
  const sorted = [...entries].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const first = formatShortDate(sorted[0].created_at);
  const last = formatShortDate(sorted[sorted.length - 1].created_at);
  if (first === last) return first;
  const firstDate = new Date(sorted[0].created_at);
  const lastDate = new Date(sorted[sorted.length - 1].created_at);
  if (firstDate.getFullYear() === lastDate.getFullYear()) {
    const start = firstDate.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
    });
    const end = lastDate.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${start} – ${end}`;
  }
  return `${first} – ${last}`;
}

/*
 * Editorial share page: flat canvas, typographic hierarchy, whitespace grouping.
 * No cards, glow, or chrome — section breaks are margin + hairline rules only.
 */
const SHARE_CSS = `
  :root {
    color-scheme: dark;
    --bg: #0a0a0e;
    --fg: #e4e4e9;
    --fg-dim: #9b9fa9;
    --meta: rgba(255, 255, 255, 0.5);
    --rule: rgba(255, 255, 255, 0.08);
    --accent: rgba(160, 170, 255, 0.88);
    --measure: 34rem;
    --space-sm: 0.5rem;
    --space-md: 1rem;
    --space-lg: 1.75rem;
    --space-xl: 2.5rem;
  }
  * { box-sizing: border-box; }
  html { min-height: 100%; }
  body {
    margin: 0;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    padding: 2rem 1.15rem 2rem;
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.6;
    letter-spacing: 0.005em;
    background: var(--bg);
    color: var(--fg);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  .document {
    flex: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: var(--measure);
    margin: 0 auto;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .document-header {
    margin-bottom: 0;
    padding-bottom: var(--space-lg);
    border-bottom: 1px solid var(--rule);
  }
  .masthead-top {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.55rem 0.65rem;
    margin-bottom: 0.4rem;
  }
  .document-brand {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--fg-dim);
    text-decoration: none;
  }
  .document-brand:hover {
    color: var(--fg);
    text-decoration: none;
  }
  .brand-logo {
    flex-shrink: 0;
    color: rgba(160, 170, 255, 0.8);
  }
  .document-brand-name {
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.03em;
  }
  .document-eyebrow {
    margin: 0;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--meta);
  }
  .masthead-top .document-eyebrow::before {
    content: "·";
    margin-right: 0.65rem;
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
    color: rgba(255, 255, 255, 0.22);
  }
  .document-lede {
    margin: 0;
    max-width: 28rem;
    font-size: 13px;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.62);
  }
  .document-intent {
    margin: 0.6rem 0 0;
    padding-left: 0.75rem;
    border-left: 2px solid rgba(160, 170, 255, 0.38);
    font-size: 15px;
    font-weight: 500;
    line-height: 1.55;
    color: var(--fg);
  }
  .thread-meta {
    margin: 0 0 0.65rem;
    font-size: 12px;
    line-height: 1.45;
    color: var(--meta);
  }
  .thread {
    display: flex;
    flex-direction: column;
    padding-top: var(--space-xl);
  }
  .beat {
    margin: 0;
  }
  .beat + .beat {
    margin-top: var(--space-lg);
  }
  .beat-time {
    display: block;
    margin: 0 0 var(--space-sm);
    font-size: 11px;
    line-height: 1.4;
    letter-spacing: 0.02em;
    color: var(--meta);
  }
  .readable {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    word-break: break-word;
    color: var(--fg);
  }
  .readable-p {
    margin: 0;
    line-height: 1.6;
  }
  .readable-list {
    margin: 0;
    padding-left: 1.15rem;
    list-style: disc;
  }
  .readable-list li {
    line-height: 1.6;
  }
  .readable-list li + li {
    margin-top: 0.2rem;
  }
  .readable-blockquote {
    margin: 0;
    padding-left: 0.75rem;
    border-left: 2px solid rgba(255, 255, 255, 0.18);
    color: rgba(255, 255, 255, 0.62);
  }
  .readable-blockquote-line {
    margin: 0;
    line-height: 1.6;
  }
  .readable-blockquote-line + .readable-blockquote-line {
    margin-top: 0.3rem;
  }
  .readable-question {
    color: rgba(255, 255, 255, 0.96);
  }
  .readable-continuation {
    margin: 0.5rem 0 0;
    padding-left: 0.75rem;
    border-left: 2px solid color-mix(in srgb, var(--accent) 38%, transparent);
  }
  .readable-continuation-label {
    margin: 0 0 0.35rem;
    font-size: 11px;
    color: var(--meta);
  }
  .readable-continuation .readable-p,
  .readable-continuation .readable-list,
  .readable-continuation .readable-blockquote {
    color: rgba(255, 255, 255, 0.76);
  }
  a {
    color: var(--accent);
    text-decoration: underline;
    text-decoration-color: rgba(160, 170, 255, 0.28);
    text-underline-offset: 2px;
  }
  a:hover {
    text-decoration-color: rgba(160, 170, 255, 0.55);
  }
  .related {
    margin-top: var(--space-xl);
    padding-top: var(--space-lg);
    border-top: 1px solid var(--rule);
  }
  .related-title {
    margin: 0 0 0.35rem;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--meta);
  }
  .related-lede {
    margin: 0 0 0.85rem;
    font-size: 12px;
    line-height: 1.45;
    color: var(--meta);
  }
  .related-entries {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .related-entry {
    margin: 0;
  }
  .related-line {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
  }
  .related-when {
    font-size: 12px;
    color: var(--meta);
  }
  .related-line .related-when::after {
    content: " — ";
    color: rgba(255, 255, 255, 0.38);
  }
  .related-snippet {
    color: rgba(255, 255, 255, 0.72);
  }
  .related-entry--full .related-when {
    display: block;
    margin: 0 0 0.35rem;
    font-size: 11px;
    line-height: 1.35;
  }
  .related-entry--full .related-when::after {
    content: none;
  }
  .related-entry--full .readable {
    font-size: 13px;
    line-height: 1.55;
    color: rgba(255, 255, 255, 0.72);
  }
  .document-end {
    margin-top: auto;
    padding-top: var(--space-xl);
  }
  .document-footer {
    margin: 0;
    padding-top: var(--space-md);
    border-top: 1px solid var(--rule);
    font-size: 11px;
    line-height: 1.5;
    color: var(--meta);
  }
  .studio-signature {
    margin: 1.15rem 0 0;
    padding: 0;
    text-align: center;
    font-size: 10px;
    font-weight: 400;
    letter-spacing: 0.04em;
    color: rgba(160, 170, 255, 0.48);
    pointer-events: none;
  }
  @media (max-width: 480px) {
    body { padding: 1.5rem 1rem 2rem; }
    .beat + .beat { margin-top: 1.35rem; }
    .document-intent { font-size: 14px; }
  }
  @media print {
    body {
      min-height: auto;
      padding: 0;
      background: #fff;
      color: #111;
    }
    .document-header,
    .related,
    .document-footer {
      border-color: rgba(0, 0, 0, 0.12);
    }
    .document-brand,
    .brand-logo,
    a,
    .studio-signature {
      color: #333;
    }
    .beat-time,
    .thread-meta,
    .document-lede,
    .document-eyebrow,
    .related-lede,
    .related-when,
    .document-footer {
      color: #555;
    }
    .studio-signature {
      opacity: 1;
    }
  }
`;

function pageMetaLine(count: number, range: string): string {
  const thoughts = `${count} thought${count === 1 ? "" : "s"}`;
  return range ? `${thoughts} · ${range}` : thoughts;
}

function documentTitle(contextNote: string | undefined, entries: Entry[]): string {
  const note = contextNote?.trim();
  if (note) return note;
  const first = entries[0]?.text.trim();
  if (first) return first.length > 60 ? `${first.slice(0, 57)}…` : first;
  return "Shared thread";
}

function ogDescription(
  contextNote: string | undefined,
  entries: Entry[]
): string {
  const note = contextNote?.trim();
  if (note) return note;
  const first = entries[0]?.text.trim();
  if (!first) return "A private read-only thread shared from Chinotto.";
  return first.length > 160 ? `${first.slice(0, 157)}…` : first;
}

function renderRelatedSection(entries: Entry[]): string {
  if (entries.length === 0) return "";
  const sorted = [...entries].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const items = sorted.map((entry) => renderRelatedEntry(entry)).join("\n");
  return `    <section class="related" aria-labelledby="related-thoughts-title">
      <h2 class="related-title" id="related-thoughts-title">Related thoughts</h2>
      <p class="related-lede">Connected context — not part of the thread above.</p>
      <ul class="related-entries">
${items}
      </ul>
    </section>`;
}

export function buildShareThreadHtml(input: ShareThreadHtmlInput): string {
  const sorted = [...input.entries].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const related = (input.relatedEntries ?? []).filter(
    (entry) => !sorted.some((beat) => beat.id === entry.id)
  );
  const count = sorted.length;
  const note = input.contextNote?.trim() ?? "";
  const title = documentTitle(note || undefined, sorted);
  const description = escapeHtml(ogDescription(input.contextNote, sorted));
  const brand = `<div class="masthead-top">
      <a class="document-brand" href="${CHINOTTO_SITE_URL}" rel="noopener noreferrer">
        ${chinottoLogoSvg(22)}
        <span class="document-brand-name">Chinotto</span>
      </a>
      <span class="document-eyebrow">Shared thread</span>
    </div>`;
  const lede = note
    ? ""
    : `<p class="document-lede">A private read-only thread of thoughts, shared with you.</p>`;
  const intent = note
    ? `<p class="document-intent">${escapeHtml(note)}</p>`
    : "";
  const articles = sorted
    .map((entry, index) => {
      const body = renderEntryBody(entry);
      const previousIso = index > 0 ? sorted[index - 1].created_at : null;
      const stamp = escapeHtml(beatTimestamp(entry.created_at, previousIso));
      return `      <section class="beat">
        <time class="beat-time" datetime="${escapeHtml(entry.created_at)}">${stamp}</time>
        ${body}
      </section>`;
    })
    .join("\n");

  const expires = escapeHtml(formatCompactTimestamp(input.expiresAt));
  const threadMeta = escapeHtml(pageMetaLine(count, dateRangeLabel(sorted)));
  const relatedBlock = renderRelatedSection(related);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <meta name="description" content="${description}" />
  <meta property="og:title" content="${escapeHtml(title)} · Chinotto" />
  <meta property="og:description" content="${description}" />
  <meta property="og:type" content="article" />
  <meta name="theme-color" content="#0a0a0e" />
  <title>${escapeHtml(title)} · Chinotto</title>
  <link rel="icon" type="image/svg+xml" href="${CHINOTTO_SITE_URL}/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&amp;display=swap" rel="stylesheet" />
  <style>${SHARE_CSS}</style>
</head>
<body>
  <article class="document">
    <h1 class="sr-only">${escapeHtml(title)}</h1>
    <header class="document-header">
      ${brand}
      ${lede}
      ${intent}
    </header>
    <section class="thread" aria-label="Thread">
      <p class="thread-meta">${threadMeta}</p>
${articles}
    </section>
${relatedBlock}
    <div class="document-end">
      <footer class="document-footer">
        Read-only · Expires ${expires}
      </footer>
      <p class="studio-signature" aria-hidden="true">Bogart Labs</p>
    </div>
  </article>
</body>
</html>`;
}
