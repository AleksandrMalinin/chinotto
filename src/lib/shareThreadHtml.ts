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
    --fg: #e4e4e9;
    --fg-strong: rgba(255, 255, 255, 0.96);
    --muted: #9b9fa9;
    --meta: rgba(255, 255, 255, 0.55);
    --border: rgba(255, 255, 255, 0.08);
    --accent: rgba(160, 170, 255, 0.9);
    --accent-bar: rgba(138, 148, 200, 0.42);
    --glow-violet: rgba(100, 110, 180, 0.12);
    --glow-blue: rgba(70, 100, 180, 0.08);
  }
  * { box-sizing: border-box; }
  html { min-height: 100%; }
  body {
    margin: 0;
    min-height: 100%;
    padding: 2.5rem 1.25rem 3.5rem;
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 16px;
    font-weight: 400;
    line-height: 1.5;
    background-color: var(--bg);
    background-image:
      radial-gradient(ellipse 80% 50% at 50% -10%, var(--glow-violet), transparent 55%),
      radial-gradient(ellipse 60% 40% at 100% 0%, var(--glow-blue), transparent 50%);
    color: var(--fg);
    -webkit-font-smoothing: antialiased;
  }
  .wrap {
    max-width: 40rem;
    margin: 0 auto;
  }
  .page-header {
    margin-bottom: 2.25rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid var(--border);
  }
  .page-kicker {
    margin: 0 0 0.5rem;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .page-title {
    margin: 0 0 0.4rem;
    font-size: clamp(1.5rem, 4vw, 1.75rem);
    font-weight: 300;
    letter-spacing: -0.02em;
    line-height: 1.25;
    color: var(--fg);
  }
  .page-meta {
    margin: 0;
    font-size: 13px;
    letter-spacing: 0.02em;
    color: var(--meta);
  }
  .page-context {
    margin: 1rem 0 0;
    padding: 0.75rem 0.9rem;
    font-size: 15px;
    line-height: 1.5;
    color: var(--fg);
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border);
    border-radius: 0.65rem;
  }
  .thread {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .beat {
    margin: 0;
    padding: 1.35rem 0 0;
    border: 0;
  }
  .beat + .beat {
    margin-top: 1.35rem;
    padding-top: 1.35rem;
    border-top: 1px solid var(--border);
  }
  .beat-time {
    display: block;
    margin: 0 0 0.65rem;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .readable {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .readable-p {
    margin: 0;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.9);
  }
  .readable-list {
    margin: 0;
    padding-left: 1.2rem;
    list-style: disc;
  }
  .readable-list li {
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.9);
  }
  .readable-list li + li {
    margin-top: 0.2rem;
  }
  .readable-blockquote {
    margin: 0;
    padding-left: 0.85rem;
    border-left: 2px solid rgba(255, 255, 255, 0.18);
    color: rgba(255, 255, 255, 0.62);
  }
  .readable-blockquote-line {
    margin: 0;
    line-height: 1.5;
  }
  .readable-blockquote-line + .readable-blockquote-line {
    margin-top: 0.35rem;
  }
  .readable-question {
    color: var(--fg-strong);
  }
  .readable-continuation {
    margin: 0.15rem 0 0;
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
    text-decoration-color: rgba(160, 170, 255, 0.65);
  }
  .page-footer {
    margin-top: 2.75rem;
    padding-top: 1.15rem;
    border-top: 1px solid var(--border);
    font-size: 12px;
    line-height: 1.55;
    color: var(--meta);
  }
  .page-footer p {
    margin: 0;
  }
  .page-footer p + p {
    margin-top: 0.45rem;
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
`;

export function buildShareThreadHtml(input: ShareThreadHtmlInput): string {
  const sorted = [...input.entries].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const count = sorted.length;
  const articles = sorted
    .map((entry) => {
      const body = renderEntryBody(entry);
      return `<article class="beat">
  <time class="beat-time" datetime="${escapeHtml(entry.created_at)}">${escapeHtml(formatEntryTimestamp(entry.created_at))}</time>
  ${body}
</article>`;
    })
    .join("\n");

  const context = input.contextNote?.trim()
    ? `<p class="page-context">${escapeHtml(input.contextNote.trim())}</p>`
    : "";

  const expires = escapeHtml(formatContinuationDate(input.expiresAt));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Shared thread · Chinotto</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&amp;display=swap" rel="stylesheet" />
  <style>${SHARE_CSS}</style>
</head>
<body>
  <div class="wrap">
    <header class="page-header">
      <p class="page-kicker">Chinotto</p>
      <h1 class="page-title">Shared thread</h1>
      <p class="page-meta">${count} thought${count === 1 ? "" : "s"} · ${escapeHtml(dateRangeLabel(sorted))} · oldest first</p>
      ${context}
    </header>
    <div class="thread">
      ${articles}
    </div>
    <footer class="page-footer">
      <p>Read-only · Expires ${expires}</p>
      <p><a href="${CHINOTTO_SITE_URL}" rel="noopener noreferrer">getchinotto.app</a></p>
    </footer>
  </div>
</body>
</html>`;
}
