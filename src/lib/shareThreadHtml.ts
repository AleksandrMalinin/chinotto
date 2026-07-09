import type { Entry } from "../types/entry";
import { formatContinuationDate } from "./formatContinuationDate";
import {
  parseReadablePlainText,
  type ReadableBlock,
  type ReadableLine,
} from "./readablePlainText";

export type ShareThreadHtmlInput = {
  contextNote?: string;
  expiresAt: string;
  entries: Entry[];
};

const CHINOTTO_SITE_URL = "https://getchinotto.app";

function chinottoLogoSvg(size = 40): string {
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

function formatEntryTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
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
      ? `<p class="readable-continuation-label">Added ${escapeHtml(formatContinuationDate(entry.continuation_at))}</p>`
      : "";
    html += `<section class="readable-continuation">${label}<div class="readable">${renderBlocks(parseReadablePlainText(secondary))}</div></section>`;
  }
  return html;
}

function dateRangeLabel(entries: Entry[]): string {
  if (entries.length === 0) return "";
  const sorted = [...entries].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const first = formatEntryTimestamp(sorted[0].created_at);
  const last = formatEntryTimestamp(sorted[sorted.length - 1].created_at);
  if (first === last) return first;
  return `${first} – ${last}`;
}

const SHARE_CSS = `
  :root {
    color-scheme: dark;
    --bg: #0a0a0e;
    --bg-elevated: #0f0f14;
    --fg: #e4e4e9;
    --fg-strong: rgba(255, 255, 255, 0.96);
    --muted: #9b9fa9;
    --meta: rgba(255, 255, 255, 0.55);
    --border: rgba(255, 255, 255, 0.08);
    --border-strong: rgba(138, 148, 200, 0.18);
    --accent: rgba(160, 170, 255, 0.92);
    --accent-soft: rgba(160, 170, 255, 0.55);
    --accent-bar: rgba(138, 148, 200, 0.42);
    --glow-violet: rgba(100, 110, 180, 0.14);
    --glow-blue: rgba(70, 100, 180, 0.1);
    --panel-shadow: 0 28px 90px rgba(0, 0, 0, 0.42);
  }
  * { box-sizing: border-box; }
  html { min-height: 100%; }
  body {
    margin: 0;
    min-height: 100%;
    padding: 2.75rem 1.25rem 4rem;
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 16px;
    font-weight: 400;
    line-height: 1.5;
    background-color: var(--bg);
    background-image:
      radial-gradient(ellipse 90% 55% at 50% -8%, var(--glow-violet), transparent 58%),
      radial-gradient(ellipse 55% 45% at 100% 0%, var(--glow-blue), transparent 52%),
      radial-gradient(ellipse 40% 35% at 0% 100%, rgba(60, 70, 120, 0.06), transparent 55%);
    color: var(--fg);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  .shell {
    max-width: 36rem;
    margin: 0 auto;
    text-align: center;
    animation: shell-in 0.55s ease-out both;
  }
  @keyframes shell-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .masthead {
    margin-bottom: 2rem;
  }
  .brand {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 0.55rem;
    margin-bottom: 1.75rem;
    color: var(--accent);
    text-decoration: none;
    transition: color 0.15s ease, opacity 0.15s ease;
  }
  .brand:hover {
    color: var(--fg-strong);
    opacity: 0.92;
  }
  .brand-name {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .brand:hover .brand-name {
    color: var(--fg);
  }
  .eyebrow {
    margin: 0 0 0.65rem;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .page-title {
    margin: 0 0 1rem;
    font-size: clamp(1.65rem, 5vw, 2rem);
    font-weight: 300;
    letter-spacing: -0.03em;
    line-height: 1.2;
    color: var(--fg-strong);
  }
  .meta-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.45rem;
    margin: 0 0 1.25rem;
  }
  .meta-chip {
    display: inline-flex;
    align-items: center;
    padding: 0.28rem 0.65rem;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--meta);
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border);
    border-radius: 999px;
  }
  .page-context {
    margin: 0 auto;
    max-width: 30rem;
    padding: 0.85rem 1rem;
    font-size: 15px;
    line-height: 1.55;
    color: var(--fg);
    text-align: center;
    background: linear-gradient(135deg, rgba(100, 120, 180, 0.08), rgba(80, 100, 150, 0.06));
    border: 1px solid var(--border-strong);
    border-radius: 0.75rem;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }
  .thread-panel {
    padding: 1.35rem 1.15rem 1.5rem;
    text-align: left;
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.012));
    border: 1px solid var(--border);
    border-radius: 1rem;
    box-shadow: var(--panel-shadow), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }
  .thread {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .beat {
    margin: 0;
    padding: 0;
    border: 0;
  }
  .beat + .beat {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border);
  }
  .beat-head {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    margin-bottom: 0.85rem;
    text-align: center;
  }
  .beat-index {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.12em;
    color: var(--accent-soft);
  }
  .beat-time {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .beat-body {
    max-width: 32rem;
    margin: 0 auto;
  }
  .readable {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .readable-p {
    margin: 0;
    line-height: 1.58;
    color: rgba(255, 255, 255, 0.9);
  }
  .readable-list {
    margin: 0;
    padding-left: 1.2rem;
    list-style: disc;
  }
  .readable-list li {
    line-height: 1.58;
    color: rgba(255, 255, 255, 0.9);
  }
  .readable-list li + li {
    margin-top: 0.25rem;
  }
  .readable-blockquote {
    margin: 0;
    padding-left: 0.85rem;
    border-left: 2px solid rgba(255, 255, 255, 0.18);
    color: rgba(255, 255, 255, 0.62);
  }
  .readable-blockquote-line {
    margin: 0;
    line-height: 1.58;
  }
  .readable-blockquote-line + .readable-blockquote-line {
    margin-top: 0.35rem;
  }
  .readable-question {
    color: var(--fg-strong);
  }
  .readable-continuation {
    margin: 0.2rem 0 0;
    padding: 0.15rem 0 0 0.9rem;
    border-left: 2px solid var(--accent-bar);
  }
  .readable-continuation-label {
    margin: 0 0 0.4rem;
    font-size: 12px;
    color: var(--meta);
  }
  .readable-continuation .readable-p,
  .readable-continuation .readable-list,
  .readable-continuation .readable-blockquote {
    color: rgba(255, 255, 255, 0.78);
  }
  a {
    color: var(--accent);
    text-decoration: underline;
    text-decoration-color: rgba(160, 170, 255, 0.35);
    text-underline-offset: 2px;
  }
  a:hover {
    text-decoration-color: rgba(160, 170, 255, 0.7);
  }
  .page-footer {
    margin-top: 2.25rem;
    padding-top: 1.35rem;
    border-top: 1px solid var(--border);
    font-size: 12px;
    line-height: 1.55;
    color: var(--meta);
  }
  .footer-brand {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    margin-bottom: 0.65rem;
    color: var(--muted);
    text-decoration: none;
    transition: color 0.15s ease;
  }
  .footer-brand:hover {
    color: var(--fg);
    text-decoration: none;
  }
  .footer-brand .brand-logo {
    width: 18px;
    height: 18px;
    opacity: 0.85;
  }
  .page-footer p {
    margin: 0;
  }
  .page-footer p + p {
    margin-top: 0.35rem;
  }
  .page-footer a {
    font-size: 12px;
    text-decoration: none;
    color: var(--muted);
  }
  .page-footer a:hover {
    color: var(--fg);
    text-decoration: underline;
  }
  @media (max-width: 480px) {
    body { padding: 2rem 1rem 3rem; }
    .thread-panel { padding: 1.1rem 0.95rem 1.25rem; }
  }
  @media (prefers-reduced-motion: reduce) {
    .shell { animation: none; }
  }
`;

function pageTitle(contextNote: string | undefined, count: number): string {
  const note = contextNote?.trim();
  if (note) return note;
  return count === 1 ? "One thought" : "A thread of thoughts";
}

function ogDescription(
  contextNote: string | undefined,
  entries: Entry[]
): string {
  const note = contextNote?.trim();
  if (note) return note;
  const first = entries[0]?.text.trim();
  if (!first) return "A read-only thread shared from Chinotto.";
  return first.length > 160 ? `${first.slice(0, 157)}…` : first;
}

export function buildShareThreadHtml(input: ShareThreadHtmlInput): string {
  const sorted = [...input.entries].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const count = sorted.length;
  const note = input.contextNote?.trim() ?? "";
  const title = pageTitle(note || undefined, count);
  const description = escapeHtml(ogDescription(input.contextNote, sorted));
  const articles = sorted
    .map((entry, index) => {
      const body = renderEntryBody(entry);
      const indexLabel = String(index + 1).padStart(2, "0");
      return `<article class="beat">
  <div class="beat-head">
    <span class="beat-index" aria-hidden="true">${indexLabel}</span>
    <time class="beat-time" datetime="${escapeHtml(entry.created_at)}">${escapeHtml(formatEntryTimestamp(entry.created_at))}</time>
  </div>
  <div class="beat-body">${body}</div>
</article>`;
    })
    .join("\n");

  const contextBlock =
    note && title !== note
      ? `<p class="page-context">${escapeHtml(note)}</p>`
      : "";

  const expires = escapeHtml(formatContinuationDate(input.expiresAt));
  const range = escapeHtml(dateRangeLabel(sorted));
  const logo = chinottoLogoSvg(44);
  const footerLogo = chinottoLogoSvg(18);

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
  <title>${escapeHtml(title)} · Chinotto</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&amp;display=swap" rel="stylesheet" />
  <style>${SHARE_CSS}</style>
</head>
<body>
  <div class="shell">
    <header class="masthead">
      <a class="brand" href="${CHINOTTO_SITE_URL}" rel="noopener noreferrer">
        ${logo}
        <span class="brand-name">Chinotto</span>
      </a>
      <p class="eyebrow">Shared thread</p>
      <h1 class="page-title">${escapeHtml(title)}</h1>
      <div class="meta-row">
        <span class="meta-chip">${count} thought${count === 1 ? "" : "s"}</span>
        <span class="meta-chip">${range}</span>
        <span class="meta-chip">Oldest first</span>
      </div>
      ${contextBlock}
    </header>
    <main class="thread-panel">
      <div class="thread">
        ${articles}
      </div>
    </main>
    <footer class="page-footer">
      <a class="footer-brand" href="${CHINOTTO_SITE_URL}" rel="noopener noreferrer">
        ${footerLogo}
        <span>Chinotto</span>
      </a>
      <p>Read-only · Expires ${expires}</p>
      <p><a href="${CHINOTTO_SITE_URL}" rel="noopener noreferrer">getchinotto.app</a></p>
    </footer>
  </div>
</body>
</html>`;
}
