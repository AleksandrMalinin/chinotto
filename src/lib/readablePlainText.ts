/**
 * Parse plain entry text into render blocks (paragraphs, flat lists, blockquotes).
 * Storage stays a single string; formatting is render-only.
 */

export type ReadableLine = {
  text: string;
  kind: "plain" | "bullet" | "blockquote";
  isQuestion: boolean;
};

export type ReadableBlock =
  | { type: "paragraph"; lines: ReadableLine[] }
  | { type: "list"; items: ReadableLine[] }
  | { type: "blockquote"; lines: ReadableLine[] };

const BULLET_PREFIX_RE = /^[-•]\s+/;
const BLOCKQUOTE_PREFIX_RE = /^>\s?/;

export function classifyPreviewLine(line: string): ReadableLine {
  return parseLine(line);
}

function parseLine(raw: string): ReadableLine {
  let text = raw;
  let kind: ReadableLine["kind"] = "plain";

  if (BLOCKQUOTE_PREFIX_RE.test(raw)) {
    text = raw.replace(BLOCKQUOTE_PREFIX_RE, "");
    kind = "blockquote";
  } else if (BULLET_PREFIX_RE.test(raw)) {
    text = raw.replace(BULLET_PREFIX_RE, "");
    kind = "bullet";
  }

  const isQuestion = text.trimEnd().endsWith("?");
  return { text, kind, isQuestion };
}

export function parseReadablePlainText(text: string): ReadableBlock[] {
  if (!text) return [];

  const blocks: ReadableBlock[] = [];
  const sections = text.split(/\n\n+/);

  for (const section of sections) {
    if (!section.trim()) continue;
    const rawLines = section.split("\n");
    let i = 0;

    while (i < rawLines.length) {
      const first = parseLine(rawLines[i]);

      if (first.kind === "bullet") {
        const items: ReadableLine[] = [];
        while (i < rawLines.length) {
          const line = parseLine(rawLines[i]);
          if (line.kind !== "bullet") break;
          items.push({ text: line.text, kind: "bullet", isQuestion: line.isQuestion });
          i++;
        }
        blocks.push({ type: "list", items });
        continue;
      }

      if (first.kind === "blockquote") {
        const lines: ReadableLine[] = [];
        while (i < rawLines.length) {
          const line = parseLine(rawLines[i]);
          if (line.kind !== "blockquote") break;
          lines.push({
            text: line.text,
            kind: "blockquote",
            isQuestion: line.isQuestion,
          });
          i++;
        }
        blocks.push({ type: "blockquote", lines });
        continue;
      }

      const lines: ReadableLine[] = [];
      while (i < rawLines.length) {
        const line = parseLine(rawLines[i]);
        if (line.kind === "bullet" || line.kind === "blockquote") break;
        lines.push({ text: line.text, kind: "plain", isQuestion: line.isQuestion });
        i++;
      }
      if (lines.length > 0) {
        blocks.push({ type: "paragraph", lines });
      }
    }
  }

  return blocks;
}
