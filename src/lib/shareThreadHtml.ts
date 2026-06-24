import type { Entry } from "../types/entry";
import { formatContinuationDate } from "./formatContinuationDate";
import {
  parseReadablePlainText,
  type ReadableBlock,
  type ReadableLine,
} from "./readablePlainText";
import { streamPreviewFirstLine } from "./streamPreviewFirstLine";

export type ShareThreadHtmlInput = {
  contextNote?: string;
  expiresAt: string;
  entries: Entry[];
};

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
  const cls = line.isQuestion ? ' class="question"' : "";
  return `<span${cls}>${linkifyHtml(line.text)}</span>`;
}

function renderBlocks(blocks: ReadableBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "list") {
        const items = block.items.map((item) => `<li>${renderLine(item)}</li>`).join("");
        return `<ul>${items}</ul>`;
      }
      if (block.type === "blockquote") {
        const lines = block.lines
          .map((line) => `<p>${renderLine(line)}</p>`)
          .join("");
        return `<blockquote>${lines}</blockquote>`;
      }
      const lines = block.lines
        .map((line, i) => (i > 0 ? `<br />${renderLine(line)}` : renderLine(line)))
        .join("");
      return `<p>${lines}</p>`;
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
    return renderBlocks(parseReadablePlainText(entry.text));
  }
  const primary = entry.text.slice(0, from);
  const secondary = entry.text.slice(from).replace(/^\n/, "");
  let html = renderBlocks(parseReadablePlainText(primary));
  if (secondary.trim()) {
    const label = entry.continuation_at
      ? `<p class="continuation-label">Added ${escapeHtml(formatContinuationDate(entry.continuation_at))}</p>`
      : "";
    html += `<section class="continuation">${label}${renderBlocks(parseReadablePlainText(secondary))}</section>`;
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
  :root { color-scheme: dark; }
  body {
    margin: 0;
    padding: 2rem 1.25rem 3rem;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 16px;
    line-height: 1.5;
    background: #121214;
    color: rgba(255, 255, 255, 0.9);
  }
  .wrap { max-width: 640px; margin: 0 auto; }
  .header { margin-bottom: 2rem; }
  .header h1 {
    margin: 0 0 0.35rem;
    font-size: 1.125rem;
    font-weight: 500;
  }
  .header .meta {
    margin: 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
  }
  .header .note {
    margin: 0.75rem 0 0;
    font-size: 15px;
    color: rgba(255, 255, 255, 0.78);
  }
  article {
    margin: 0 0 1.75rem;
    padding: 0;
  }
  article time {
    display: block;
    margin-bottom: 0.35rem;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.48);
  }
  article .preview {
    margin: 0 0 0.5rem;
    font-size: 15px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.92);
  }
  p { margin: 0 0 0.75rem; }
  ul { margin: 0 0 0.75rem; padding-left: 1.2rem; }
  blockquote {
    margin: 0 0 0.75rem;
    padding-left: 0.85rem;
    border-left: 2px solid rgba(255, 255, 255, 0.18);
    color: rgba(255, 255, 255, 0.62);
  }
  blockquote p { margin: 0; }
  blockquote p + p { margin-top: 0.35rem; }
  .question { color: rgba(255, 255, 255, 0.96); }
  .continuation {
    margin-top: 0.5rem;
    padding-left: 0.9rem;
    border-left: 2px solid rgba(138, 148, 200, 0.42);
    color: rgba(255, 255, 255, 0.78);
  }
  .continuation-label {
    margin: 0 0 0.4rem;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.48);
  }
  a { color: #9aa8e8; }
  footer {
    margin-top: 2.5rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    font-size: 12px;
    color: rgba(255, 255, 255, 0.45);
  }
`;

export function buildShareThreadHtml(input: ShareThreadHtmlInput): string {
  const sorted = [...input.entries].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const count = sorted.length;
  const articles = sorted
    .map((entry) => {
      const preview = escapeHtml(streamPreviewFirstLine(entry.text));
      const body = renderEntryBody(entry);
      return `<article>
  <time datetime="${escapeHtml(entry.created_at)}">${escapeHtml(formatEntryTimestamp(entry.created_at))}</time>
  <p class="preview">${preview}</p>
  <div class="body">${body}</div>
</article>`;
    })
    .join("\n");

  const context = input.contextNote?.trim()
    ? `<p class="note">${escapeHtml(input.contextNote.trim())}</p>`
    : "";

  const expires = escapeHtml(formatContinuationDate(input.expiresAt));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Shared thoughts · Chinotto</title>
  <style>${SHARE_CSS}</style>
</head>
<body>
  <div class="wrap">
    <header class="header">
      <h1>Shared thoughts</h1>
      <p class="meta">${count} thought${count === 1 ? "" : "s"} · ${escapeHtml(dateRangeLabel(sorted))}</p>
      ${context}
    </header>
    ${articles}
    <footer>
      Shared read-only · Expires ${expires} · Chinotto
    </footer>
  </div>
</body>
</html>`;
}
